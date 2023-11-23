import superagent from "superagent";
import assert from "assert";
import { startServer } from "../server.js";
import {
  getDatabaseConnection,
  closeDatabaseConnection,
} from "../mongoUtils.js";
import fs from "fs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

// WARNING: Only for testing purposes!
// This is needed because the certificate is self-signed
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let server;
let api = "https://localhost:3000";

let agent = superagent.agent();

// Helper functions to get proper UIDs and message IDs
// Used for easier access when we do not have access to the UID
const fetchUser = async (username) => {
  const user = await getDatabaseConnection()
    .collection("users")
    .findOne({ username });
  // does technically return the encrypted password, which is fine for testing
  return user;
};

const createManualUser = (username, password, firstname, surname, email) => {
  return new Promise((resolve, reject) => {
    agent
      .post(`${api}/users/register`)
      .send({
        firstname: firstname,
        surname: surname,
        username: username,
        password: password,
        confirmPassword: password,
        email: email,
      })
      .end((err, res) => {
        if (err) {
          reject(err);
        } else {
          agent.post(`${api}/logout`).end((err, res) => {
            if (err) {
              reject(err);
            } else {
              resolve(res);
            }
          });
        }
      });
  });
};

// we're running a tst database, so clearing it is safe
const clearDatabase = async () => {
  const db = getDatabaseConnection();
  await db.collection("users").deleteMany({});
  await db.collection("posts").deleteMany({});
};

const generateInvalidToken = (payload, secret = "wrongSecret") => {
  return jwt.sign(payload, secret, { expiresIn: "15m" });
};

const generateAuthToken = (user, expired = true) => {
  const AUTH_SEC = fs.readFileSync("keys/authtoken", "utf8");
  if (expired) {
    return jwt.sign(
      { userId: user.uid, username: user.username, name: user.firstname },
      AUTH_SEC,
      {
        expiresIn: "-1s",
      }
    );
  } else {
    return jwt.sign(
      { userId: user.uid, username: user.username, name: user.firstname },
      AUTH_SEC,
      {
        expiresIn: "15m",
      }
    );
  }
};

const generateRefreshToken = (user, expired = true) => {
  const REFRESH_SEC = fs.readFileSync("keys/refreshtoken", "utf8");

  if (expired) {
    return jwt.sign(
      { userId: user.uid, username: user.username, name: user.name },
      REFRESH_SEC,
      {
        expiresIn: "-1s",
      }
    );
  } else {
    return jwt.sign(
      { userId: user.uid, username: user.username, name: user.name },
      REFRESH_SEC,
      {
        expiresIn: "7d",
      }
    );
  }
};

// pre-hook
before((done) => {
  server = startServer(3000, done);
});

// post-hook
after(async () => {
  await clearDatabase();
  await closeDatabaseConnection();
  return new Promise((resolve, reject) => {
    server.close(resolve);
  });
});

describe("registration, login and validation tests", () => {
  it("POST to /users/register with valid credentials should return 201", (done) => {
    agent
      .post(`${api}/users/register`)
      .send({
        firstname: "Test",
        surname: "Testsson",
        username: "test",
        password: "testpass123",
        confirmPassword: "testpass123",
        email: "test@gmail.com",
      })
      .end((err, res) => {
        if (err) done(err);

        assert.equal(res.status, 201);
        const authCookie = res.headers["set-cookie"].find((cookie) =>
          cookie.startsWith("authToken=")
        );
        const refreshCookie = res.headers["set-cookie"].find((cookie) =>
          cookie.startsWith("refreshToken=")
        );
        assert.ok(authCookie);
        assert.ok(refreshCookie);
        done();
      });
  });

  it("POST to /users/register with invalid credentials should return 400", (done) => {
    agent
      .post(`${api}/users/register`)
      .send({
        firstname: 123,
        surname: 456,
        username: false,
        password: "testpass123",
        confirmPassword: "testpass123",
        email: "test@gmail.com",
      })
      .end((err, res) => {
        assert.equal(res.status, 400);
        done();
      });
  });

  it("POST to /logout should return 200 and clear cookies", (done) => {
    agent.post(`${api}/logout`).end((err, res) => {
      if (err) done(err);

      assert.equal(res.status, 200);
      const authCookie = res.headers["set-cookie"].find((cookie) =>
        cookie.startsWith("authToken=")
      );
      const refreshCookie = res.headers["set-cookie"].find((cookie) =>
        cookie.startsWith("refreshToken=")
      );
      assert.ok(
        authCookie &&
          authCookie.includes("Expires=") &&
          new Date(authCookie.split("Expires=")[1]) <= new Date()
      );
      assert.ok(
        refreshCookie &&
          refreshCookie.includes("Expires=") &&
          new Date(refreshCookie.split("Expires=")[1]) <= new Date()
      );

      done();
    });
  });

  it("POST to /users/login with valid credentials should return 200", (done) => {
    agent
      .post(`${api}/users/login`)
      .send({
        username: "test",
        password: "testpass123",
      })
      .end((err, res) => {
        if (err) done(err);

        assert.equal(res.status, 200);
        const authCookie = res.headers["set-cookie"].find((cookie) =>
          cookie.startsWith("authToken=")
        );
        const refreshCookie = res.headers["set-cookie"].find((cookie) =>
          cookie.startsWith("refreshToken=")
        );
        assert.ok(authCookie);
        assert.ok(refreshCookie);
        done();
      });
  });

  it("Registration or login while already logged in should return 400", (done) => {
    // start by logging in
    agent.post(`${api}/users/login`).send({
      username: "test",
      password: "testpass123",
    });

    agent
      .post(`${api}/users/register`)
      .send({
        username: "testtwo",
        password: "testpass123",
        confirmPassword: "testpass123",
        email: "test@testtwo.com",
        firstname: "Test",
        surname: "Testsson",
      })
      .end((err, res) => {
        assert.equal(res.status, 400);

        agent.post(`${api}/users/login`).send({
          username: "test",
          password: "test123",
        });
        assert.equal(res.status, 400);
        done();
      });
  });

  it("POST to /users/login while already logged in should return 400", (done) => {
    agent
      .post(`${api}/users/login`)
      .send({
        username: "test",
        password: "test1234",
      })
      .end((err, res) => {
        assert.equal(res.status, 400);
        done();
      });
  });

  it("POST to /users/login with invalid credentials should return 401", (done) => {
    // using a non-persistent agent to avoid cookies
    superagent
      .post(`${api}/users/login`)
      .send({
        username: null,
        password: null,
      })
      .end((err, res) => {
        assert.equal(res.status, 401);
      });

    superagent
      .post(`${api}/users/login`)
      .send({
        username: "test",
        password: "test1234",
      })
      .end((err, res) => {
        assert.equal(res.status, 401);
      });

    superagent
      .post(`${api}/users/login`)
      .send({
        username: "test1234",
        password: "test",
      })
      .end((err, res) => {
        assert.equal(res.status, 401);
        done();
      });
  });

  it("Manually checking username and email availability should return 200 and boolean", (done) => {
    agent
      .post(`${api}/users/check-availability`)
      .send({ username: "test", email: "test@test.com" })
      .end((err, res) => {
        assert.equal(res.status, 200);
        assert.equal(res.body.usernameAvailable, false);
      });

    agent
      .post(`${api}/users/check-availability`)
      .send({ username: "test123", email: "test123@tester.net" })
      .end((err, res) => {
        assert.equal(res.status, 200);
        assert.equal(res.body.usernameAvailable, true);
      });

    done();
  });

  it("Checking availability without parameters should return 400", (done) => {
    agent
      .post(`${api}/users/check-availability`)
      .send({})
      .end((err, res) => {
        assert.equal(res.status, 400);
      });

    done();
  });

  it("POST to /users/register with already existing username should return 400", (done) => {
    agent
      .post(`${api}/users/register`)
      .send({
        username: "test",
        password: "testpass123",
        confirmPassword: "testpass123",
        email: "test@test.com",
        firstname: "Test",
        surname: "Testsson",
      })
      .end((err, res) => {
        assert.equal(res.status, 400);
        done();
      });
  });

  it("POST to /users/register with invalid credentials should return 400", (done) => {
    agent
      .post(`${api}/users/register`)
      .send({
        username: "test143",
        password: "tester@@@",
        confirmPassword: "tester@@@",
        email: "test",
        firstname: "T",
        surname: "S",
      })
      .end((err, res) => {
        assert.equal(res.status, 400);
      });

    agent
      .post(`${api}/users/register`)
      .send({
        username: "testman",
        password: "tester@@@",
        confirmPassword: "tester@@@",
        email: "test",
        firstname: "T",
        surname: "S",
      })
      .end((err, res) => {
        assert.equal(res.status, 400);
      });

    agent
      .post(`${api}/users/register`)
      .send({
        username: "testman",
        password: "tester@@@",
        confirmPassword: "tester@@@",
        email: "test",
        firstname: "T",
        surname: "S",
      })
      .end((err, res) => {
        assert.equal(res.status, 400);
      });

    agent
      .post(`${api}/users/register`)
      .send({
        username: "testman",
        ppassword: "tester@@@",
        confirmPassword: "tester@@@",
        email: "test",
        firstname: "Tester",
        surname: "S",
      })
      .end((err, res) => {
        assert.equal(res.status, 400);
      });

    agent
      .post(`${api}/users/register`)
      .send({
        username: "testman",
        password: "tester@@@",
        confirmPassword: "tester@@@",
        email: "test",
        firstname: "Tester",
        surname: "Son",
      })
      .end((err, res) => {
        assert.equal(res.status, 400);
      });

    agent
      .post(`${api}/users/register`)
      .send({
        username: "ts",
        password: "tester@@@",
        confirmPassword: "tester@@@",
        email: "test",
        firstname: "Tester",
        surname: "Son",
      })
      .end((err, res) => {
        assert.equal(res.status, 400);
      });

    agent
      .post(`${api}/users/register`)
      .send({
        username: "testman",
        password: "tester123",
        confirmPassword: "tester456",
        email: "test",
        firstname: "Tester",
        surname: "Son",
      })
      .end((err, res) => {
        assert.equal(res.status, 400);
      });

    agent
      .post(`${api}/users/register`)
      .send({
        username: "testman",
        password: "tester123",
        confirmPassword: "tester123",
        email: "test",
        firstname: "Tester",
        surname: "Son",
      })
      .end((err, res) => {
        assert.equal(res.status, 400);
      });

    done();
  });

  it("Validating a valid token should return 200 and username", (done) => {
    agent.get(`${api}/validate`).end((err, res) => {
      assert.equal(res.status, 200);
      assert.equal(res.body.username, "test");
      done();
    });
  });

  it("Fetching user from /users/:uid should return 200 and user", (done) => {
    agent.get(`${api}/validate`).end((err, res) => {
      assert.equal(res.status, 200);
      assert.equal(res.body.username, "test");
      agent.get(`${api}/users/${res.body.uid}`).end((err, res) => {
        assert.equal(res.status, 200);
        assert.equal(res.body.username, "test");
        done();
      });
    });
  });

  it("Attempting to fetch user from /users/:uid with invalid credentials should return 400", (done) => {
    agent.get(`${api}/users/invalidUserID`).end((err, res) => {
      assert.equal(res.status, 400);
      done();
    });
  });

  it("Attempting to fetch non-existing user from /users/:uid should return 404", (done) => {
    agent.get(`${api}/users/${new ObjectId().toString()}`).end((err, res) => {
      assert.equal(res.status, 404);
      done();
    });
  });

  it("Validating with one token missing should yield a new token and return 200", (done) => {
    if (agent.Cookies) {
      agent.Cookies = agent.Cookies.filter(
        (cookie) => !cookie.startsWith(`authToken=`)
      );
    }

    agent.get(`${api}/validate`).end((err, res) => {
      assert.equal(res.status, 200);
      assert.equal(res.body.username, "test");
      done();
    });
  });

  it("Validating after logout should return 401", (done) => {
    agent.post(`${api}/logout`).end((err, res) => {
      assert.equal(res.status, 200);
      agent.get(`${api}/validate`).end((err, res) => {
        assert.equal(res.status, 401);
        done();
      });
    });
  });

  it("Validating with invalid authToken should return 401", (done) => {
    const invalidAuthToken = generateInvalidToken({
      userId: "irrelevantData",
    });

    agent
      .get(`${api}/validate`)
      .set("Cookie", `authToken=${invalidAuthToken}`)
      .end((err, res) => {
        assert.equal(res.status, 401);
        done();
      });
  });

  it("Validating with invalid authToken but valid refreshToken should return 200", (done) => {
    agent
      .post(`${api}/users/login`)
      .send({
        username: "test",
        password: "testpass123",
      })
      .end((err, res) => {
        assert.equal(res.status, 200);
        agent.get(`${api}/validate`).end((err, res) => {
          // manual tokens for testing
          const authToken = generateAuthToken(res.body);
          const refreshToken = generateRefreshToken(res.body, false);
          // sending through new instance of superagent w/o persistent cookies
          superagent
            .get(`${api}/validate`)
            .set(
              "Cookie",
              `authToken=${authToken}; refreshToken=${refreshToken}`
            )
            .end((err, res) => {
              assert.equal(res.status, 200);
              agent.post(`${api}/logout`).end((err, res) => {
                assert.equal(res.status, 200);
                done();
              });
            });
        });
      });
  });

  it("Validating with all invalid tokens should logout the user", (done) => {
    agent
      .post(`${api}/users/login`)
      .send({
        username: "test",
        password: "testpass123",
      })
      .end((err, res) => {
        assert.equal(res.status, 200);
        agent.get(`${api}/validate`).end((err, res) => {
          // manual tokens for testing
          const authToken = generateAuthToken(res.body);
          const refreshToken = generateRefreshToken(res.body);
          // sending through new instance of superagent with new persistent cookies
          const newAgent = superagent.agent();
          newAgent
            .get(`${api}/validate`)
            .set(
              "Cookie",
              `authToken=${authToken}; refreshToken=${refreshToken}`
            )
            .end((err, res) => {
              assert.equal(res.status, 401);
              newAgent.get(`${api}/validate`).end((err, res) => {
                assert.equal(res.status, 401);
                // finally, log out the user in the old agent
                agent.post(`${api}/logout`).end((err, res) => {
                  if (err) return done(err);
                  assert.equal(res.status, 200);
                  done();
                });
              });
            });
        });
      });
  });

  it("Validating with non-existing user should return 401", (done) => {
    agent.get(`${api}/validate`).end((err, res) => {
      // manual tokens for testing
      const customUser = {
        uid: new ObjectId().toString(),
        username: res.body.username,
        name: res.body.name,
      };
      const authToken = generateAuthToken(customUser, false);
      const refreshToken = generateRefreshToken(res.body, false);
      // sending through new instance of superagent w/o persistent cookies
      superagent
        .get(`${api}/validate`)
        .set("Cookie", `authToken=${authToken}; refreshToken=${refreshToken}`)
        .end((err, res) => {
          assert.equal(res.status, 401);
          done();
        });
    });
  });

  it("Validating with valid user on authtoken but not refresh token should return 401", (done) => {
    agent
      .post(`${api}/users/login`)
      .send({
        username: "test",
        password: "testpass123",
      })
      .end((err, res) => {
        assert.equal(res.status, 200);
        agent.get(`${api}/validate`).end((err, res) => {
          // manual tokens for testing
          const customUser = {
            uid: new ObjectId().toString(),
            username: res.body.username,
            name: res.body.name,
          };
          const expiredAuthToken = generateAuthToken(customUser, true);
          const refreshToken = generateRefreshToken(customUser, false);
          // sending through new instance of superagent w/o persistent cookies
          superagent
            .get(`${api}/validate`)
            .set(
              "Cookie",
              `authToken=${expiredAuthToken}; refreshToken=${refreshToken}`
            )
            .end((err, res) => {
              assert.equal(res.status, 401);
              agent.post(`${api}/logout`).end((err, res) => {
                assert.equal(res.status, 200);
                done();
              });
            });
        });
      });
  });
});

describe("user friend request tests", () => {
  before(async () => {
    await createManualUser(
      "friend1",
      "testpass123",
      "Friend",
      "One",
      "friend1@test.com"
    );

    await createManualUser(
      "friend2",
      "testpass123",
      "Friend",
      "Two",
      "friend2@test.com"
    );
  });

  it("Sending friend request from friend 1 to friend 2", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");

      // login as friend 1
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend1",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/request`)
            .send({
              uid: friend1._id.toString(),
              friendID: friend2._id.toString(),
            })
            .end((err, res) => {
              if (err) return done(err);
              assert.equal(res.status, 200);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Validating friend request from friend 1 to friend 2", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");
      assert.equal(friend1.friendRequests.sent.length, 1);
      assert.equal(friend1.friendRequests.received.length, 0);
      assert.equal(friend1.friends.length, 0);
      assert.equal(friend2.friendRequests.sent.length, 0);
      assert.equal(friend2.friendRequests.received.length, 1);
      assert.equal(friend2.friends.length, 0);

      assert.equal(friend1.friendRequests.sent[0], friend2._id.toString());
      assert.equal(friend2.friendRequests.received[0], friend1._id.toString());
      done();
    })();
  });

  it("Attempting friend request when one is pending should return 400", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");

      // login as friend 1
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend1",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/request`)
            .send({
              uid: friend1._id.toString(),
              friendID: friend2._id.toString(),
            })
            .end((err, res) => {
              try {
                assert.equal(res.status, 400);
                // logout
                agent.post(`${api}/logout`).end((err, res) => {
                  if (err) return done(err);
                  assert.equal(res.status, 200);
                  done();
                });
              } catch (error) {
                done(error);
              }
            });
        });
    })();
  });

  it("Accepting friend request from friend 2 to friend 1", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");

      // logout
      agent.post(`${api}/logout`).end((err, res) => {
        assert.equal(res.status, 200);
      });

      // login as friend 2
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend2",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/accept`)
            .send({
              uid: friend2._id.toString(),
              requesterID: friend1._id.toString(),
            })
            .end((err, res) => {
              if (err) return done(err);
              assert.equal(res.status, 200);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Validating accepted friend requests", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");
      assert.equal(friend1.friendRequests.sent.length, 0);
      assert.equal(friend1.friendRequests.received.length, 0);
      assert.equal(friend1.friends.length, 1);
      assert.equal(friend2.friendRequests.sent.length, 0);
      assert.equal(friend2.friendRequests.received.length, 0);
      assert.equal(friend2.friends.length, 1);

      assert.equal(friend1.friends[0], friend2._id.toString());
      assert.equal(friend2.friends[0], friend1._id.toString());
      done();
    })();
  });

  it("Accepting friend request while already friends should return 400", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");

      // login as friend 2
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend2",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/accept`)
            .send({
              uid: friend2._id.toString(),
              requesterID: friend1._id.toString(),
            })
            .end((err, res) => {
              assert.equal(res.status, 400);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Accepting friend request from user with no pending request should return 400", (done) => {
    (async () => {
      const friend1 = await fetchUser("test");
      const friend2 = await fetchUser("friend2");

      // login as friend 2
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend2",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/accept`)
            .send({
              uid: friend2._id.toString(),
              requesterID: friend1._id.toString(),
            })
            .end((err, res) => {
              assert.equal(res.status, 400);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Sending friend request from friend 1 to friend 2 while already friends", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");

      // login as friend 1
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend1",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/request`)
            .send({
              uid: friend1._id.toString(),
              friendID: friend2._id.toString(),
            })
            .end((err, res) => {
              assert.equal(res.status, 400);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Removing friend 1 while logged in as friend 2", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");

      // login as friend 2
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend2",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/remove`)
            .send({
              uid: friend2._id.toString(),
              friendID: friend1._id.toString(),
            })
            .end((err, res) => {
              if (err) return done(err);
              assert.equal(res.status, 200);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Validating removed friend request", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");
      assert.equal(friend1.friendRequests.sent.length, 0);
      assert.equal(friend1.friendRequests.received.length, 0);
      assert.equal(friend1.friends.length, 0);
      assert.equal(friend2.friendRequests.sent.length, 0);
      assert.equal(friend2.friendRequests.received.length, 0);
      assert.equal(friend2.friends.length, 0);
      done();
    })();
  });

  it("Attempting to remove a friend with no UIDs should return 400", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");

      // login as friend 2
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend2",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/remove`)
            .send({})
            .end((err, res) => {
              assert.equal(res.status, 400);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Removing UID that doesn't exists should retun 404", (done) => {
    (async () => {
      const friend2 = await fetchUser("friend2");

      // login as friend 2
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend2",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/remove`)
            .send({
              uid: friend2._id.toString(),
              friendID: new ObjectId().toString(),
            })
            .end((err, res) => {
              assert.equal(res.status, 404);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Removing friend 1 while not friends should return 400", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");

      // login as friend 2
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend2",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/remove`)
            .send({
              uid: friend2._id.toString(),
              friendID: friend1._id.toString(),
            })
            .end((err, res) => {
              assert.equal(res.status, 400);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Sending friend request to self should return 400", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");

      // login as friend 1
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend1",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/request`)
            .send({
              uid: friend1._id.toString(),
              friendID: friend1._id.toString(),
            })
            .end((err, res) => {
              try {
                assert.equal(res.status, 400);
                // logout
                agent.post(`${api}/logout`).end((err, res) => {
                  if (err) return done(err);
                  assert.equal(res.status, 200);
                  done();
                });
              } catch (error) {
                done(error);
              }
            });
        });
    })();
  });

  it("Sending friend request without UIDs should return 400", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");

      // login as friend 1
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend1",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/request`)
            .send({
              uid: friend1._id.toString(),
            })
            .end((err, res) => {
              assert.equal(res.status, 400);
              agent
                .post(`${api}/users/friends/request`)
                .send({
                  friendID: friend2._id.toString(),
                })
                .end((err, res) => {
                  assert.equal(res.status, 400);
                  // logout
                  agent.post(`${api}/logout`).end((err, res) => {
                    if (err) return done(err);
                    assert.equal(res.status, 200);
                    done();
                  });
                });
            });
        });
    })();
  });

  it("Sending friend request from friend 1 to non-existant UID should return 400", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");

      // login as friend 1
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend1",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/request`)
            .send({
              uid: friend1._id.toString(),
              friendID: new ObjectId().toString(),
            })
            .end((err, res) => {
              assert.equal(res.status, 404);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Sending friend request from friend 2 to friend 1", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");

      // login as friend 2
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend2",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/request`)
            .send({
              uid: friend2._id.toString(),
              friendID: friend1._id.toString(),
            })
            .end((err, res) => {
              if (err) return done(err);
              assert.equal(res.status, 200);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Validating friend request from friend 1 to friend 2", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");
      assert.equal(friend1.friendRequests.sent.length, 0);
      assert.equal(friend1.friendRequests.received.length, 1);
      assert.equal(friend1.friends.length, 0);
      assert.equal(friend2.friendRequests.sent.length, 1);
      assert.equal(friend2.friendRequests.received.length, 0);
      assert.equal(friend2.friends.length, 0);

      assert.equal(friend2.friendRequests.sent[0], friend1._id.toString());
      assert.equal(friend1.friendRequests.received[0], friend2._id.toString());
      done();
    })();
  });

  it("As friend 1, decline request from friend 2", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");

      // login as friend 1
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend1",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/decline`)
            .send({
              uid: friend1._id.toString(),
              requesterID: friend2._id.toString(),
            })
            .end((err, res) => {
              if (err) return done(err);
              assert.equal(res.status, 200);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Declining a request with no UIDs should return 400", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");

      // login as friend 1
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend1",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/decline`)
            .send({})
            .end((err, res) => {
              assert.equal(res.status, 400);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Declining a request from self should return 400", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");

      // login as friend 1
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend1",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/decline`)
            .send({
              uid: friend1._id.toString(),
              requesterID: friend1._id.toString(),
            })
            .end((err, res) => {
              assert.equal(res.status, 400);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Declining a request from non-existing user should return 404", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");

      // login as friend 1
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend1",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/decline`)
            .send({
              uid: friend1._id.toString(),
              requesterID: new ObjectId().toString(),
            })
            .end((err, res) => {
              assert.equal(res.status, 404);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Attempting to decline a request with none pending should return 400", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("test");

      // login as friend 1
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend1",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/decline`)
            .send({
              uid: friend1._id.toString(),
              requesterID: friend2._id.toString(),
            })
            .end((err, res) => {
              assert.equal(res.status, 400);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Validating declined friend request", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");
      const friend2 = await fetchUser("friend2");
      assert.equal(friend1.friendRequests.sent.length, 0);
      assert.equal(friend1.friendRequests.received.length, 0);
      assert.equal(friend1.friends.length, 0);
      assert.equal(friend2.friendRequests.sent.length, 0);
      assert.equal(friend2.friendRequests.received.length, 0);
      assert.equal(friend2.friends.length, 0);
      done();
    })();
  });

  it("Accepting friend request without UIDs should return 400", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");

      // login as friend 1
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend1",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/accept`)
            .send({})
            .end((err, res) => {
              assert.equal(res.status, 400);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Accepting friend request from self should return 400", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");

      // login as friend 1
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend1",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/accept`)
            .send({
              uid: friend1._id.toString(),
              requesterID: friend1._id.toString(),
            })
            .end((err, res) => {
              assert.equal(res.status, 400);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });

  it("Accepting friend request from non-existing user should return 400", (done) => {
    (async () => {
      const friend1 = await fetchUser("friend1");

      // login as friend 1
      agent
        .post(`${api}/users/login`)
        .send({
          username: "friend1",
          password: "testpass123",
        })
        .end((err, res) => {
          if (err) return done(err);
          assert.equal(res.status, 200);
          agent
            .post(`${api}/users/friends/accept`)
            .send({
              uid: friend1._id.toString(),
              requesterID: new ObjectId().toString(),
            })
            .end((err, res) => {
              assert.equal(res.status, 404);
              // logout
              agent.post(`${api}/logout`).end((err, res) => {
                if (err) return done(err);
                assert.equal(res.status, 200);
                done();
              });
            });
        });
    })();
  });
});

describe("search tests", () => {
  // login before commencing tests
  before((done) => {
    agent
      .post(`${api}/users/login`)
      .send({
        username: "friend1",
        password: "testpass123",
      })
      .end((err, res) => {
        assert.equal(res.status, 200);
        done();
      });
  });

  it("Searching for a user that exists should return 200", (done) => {
    agent.get(`${api}/users/find/test`).end((err, res) => {
      if (err) return done(err);
      assert.equal(res.status, 200);
      done();
    });
  });

  it("Searching for a user without text should return 400", (done) => {
    agent.get(`${api}/users/find/`).end((err, res) => {
      assert.equal(res.status, 400);
      done();
    });
  });

  // logout when done
  after((done) => {
    agent.post(`${api}/logout`).end((err, res) => {
      if (err) return done(err);
      assert.equal(res.status, 200);
      done();
    });
  });
});

describe("message tests", () => {
  it('GET from index ("/") should return "Hello"', (done) => {
    agent.get(`${api}/`).end((err, res) => {
      if (err) done(err);
      let index = res.text;
      assert.equal(index, "Hello");
      done();
    });
  });

  it('GET from messages ("/messages") before insertions should return all messages', (done) => {
    agent.get(`${api}/messages`).end((err, res) => {
      if (err) done(err);
      let messages = res.body;
      assert.deepEqual(res.status, 200);
      assert.deepEqual(messages, []);
      done();
    });
  });

  it('POST to messages ("/messages") should return 200', async () => {
    const user = await fetchUser("test");

    const res = await agent.post(`${api}/messages`).send({
      uid: user._id.toString(),
      name: user.username,
      body: "test",
      recipient: null,
    });

    assert.deepEqual(res.status, 200);
  });

  it("POST with invalid JSON object should return 400", (done) => {
    agent
      .post(`${api}/messages`)
      .send({ id: "42", name: "" })
      .end((err, res) => {
        if (err) {
          assert.equal(res.status, 400);
          done();
        }
      });
  });

  it("POST with empty JSON object should return 400", (done) => {
    agent
      .post(`${api}/messages`)
      .send({})
      .end((err, res) => {
        if (err) {
          assert.equal(res.status, 400);
          done();
        }
      });
  });

  it('GET from messages ("/messages/:id") should return message with id', (done) => {
    agent.get(`${api}/messages`).end((err, res) => {
      // Fetch all messages
      if (err) return done(err);
      let message = res.body[0]; // Get the first message (or any other logic you want)
      agent.get(`${api}/messages/${message["_id"]}`).end((err, res) => {
        assert.deepEqual(res.status, 200);
        done();
      });
    });
  });

  it('GET from messages ("/messages/:id") with invalid ID should return 404', (done) => {
    agent
      .get(`${api}/messages/${new ObjectId().toString()}`)
      .end((err, res) => {
        assert.deepEqual(res.status, 404);
        done();
      });
  });

  it('PATCH to messages ("/messages/:id") should return 200 and update the read-status', (done) => {
    agent.get(`${api}/messages`).end((err, res) => {
      if (err) return done(err);
      let message = res.body[0];
      agent
        .patch(`${api}/messages/${message["_id"]}`)
        .send({ read: true, id: "someUserId" })
        .end((err, res) => {
          assert.deepEqual(res.status, 200);
        });
      agent
        .patch(`${api}/messages/${message["_id"]}`)
        .send({ read: false, id: "someUserId" })
        .end((err, res) => {
          assert.deepEqual(res.status, 200);
          done();
        });
    });
  });

  it('PATCH to messages ("/messages/:id") with invalid JSON object should return 400', (done) => {
    agent.get(`${api}/messages`).end((err, res) => {
      if (err) return done(err);
      let message = res.body[0];
      agent
        .patch(`${api}/messages/${message["_id"]}`)
        .send({ read: "true", id: "someUserId" })
        .end((err, res) => {
          assert.deepEqual(res.status, 400);
          done();
        });
    });
  });

  it('PATCH to messages ("/messages/:id") with empty JSON object should return 400', (done) => {
    agent.get(`${api}/messages`).end((err, res) => {
      if (err) return done(err);
      let message = res.body[0];
      agent
        .patch(`${api}/messages/${message["_id"]}`)
        .send({})
        .end((err, res) => {
          assert.deepEqual(res.status, 400);
          done();
        });
    });
  });

  it("GET to object touched by PATCH should show updated info", (done) => {
    agent.get(`${api}/messages`).end((err, res) => {
      if (err) return done(err);
      let message = res.body[0];
      agent
        .patch(`${api}/messages/${message["_id"]}`)
        .send({ read: true, id: "someUserId" })
        .end((err, res) => {
          if (err) return done(err);
          agent.get(`${api}/messages/${message["_id"]}`).end((err, res) => {
            if (err) return done(err);
            let updatedMessage = res.body;
            assert.deepEqual(updatedMessage["_id"], message["_id"]);
            assert.deepEqual(updatedMessage["name"], "test");
            assert.deepEqual(updatedMessage["body"], "test");
            assert.deepEqual(updatedMessage["usersRead"] != [], true);
            done();
          });
        });
    });
  });

  it('PATCH to messages ("/messages/:id") with invalid keys should return 400', (done) => {
    agent.get(`${api}/messages`).end((err, res) => {
      if (err) return done(err);
      let message = res.body[0];
      agent
        .patch(`${api}/messages/1234`)
        .send({ read: true, id: "someUserId", error: "error" })
        .end((err, res) => {
          assert.deepEqual(res.status, 400);
          done();
        });
    });
  });

  it('GET from messages ("/messages/:id") for a non-existing message should return 400', (done) => {
    agent.get(`${api}/messages/15`).end((err, res) => {
      if (err) {
        assert.deepEqual(res.status, 400);
      }
      done();
    });
  });

  it("GET to invalid locations should return 404", (done) => {
    agent.get(`${api}/incorrect`).end((err, res) => {
      if (err) {
        assert.equal(res.status, 404);
      }
      done();
    });
  });

  it("POST to invalid locations should return 404", (done) => {
    agent
      .get(`${api}/incorrect`)
      .send({})
      .end((err, res) => {
        if (err) {
          assert.equal(res.status, 404);
        }
        done();
      });
  });

  it("Sending incorrect request to any location should return 405", (done) => {
    agent
      .post(`${api}/messages/10`)
      .send({})
      .end((err, res) => {
        if (err) {
          assert.equal(res.status, 405);
        }
      });

    agent
      .patch(`${api}/messages`)
      .send({})
      .end((err, res) => {
        if (err) {
          assert.equal(res.status, 405);
        }
      });

    agent
      .get(`${api}/messages`)
      .send({})
      .end((err, res) => {
        if (err) {
          assert.equal(res.status, 405);
        }
      });

    agent
      .delete(`${api}/messages/10`)
      .send({})
      .end((err, res) => {
        if (err) {
          assert.equal(res.status, 405);
        }
      });

    agent
      .post(`${api}/`)
      .send({})
      .end((err, res) => {
        if (err) {
          assert.equal(res.status, 405);
        }
      });

    agent
      .patch(`${api}/`)
      .send({})
      .end((err, res) => {
        if (err) {
          assert.equal(res.status, 405);
        }
      });

    agent
      .delete(`${api}/`)
      .send({})
      .end((err, res) => {
        if (err) {
          assert.equal(res.status, 405);
        }
      });
    done();
  });

  it("Simulating a 500 error should return 500", (done) => {
    agent.get(`${api}/trigger-error`).end((err, res) => {
      if (err) {
        assert.equal(res.status, 500);
        done();
      } else {
        done(new Error("Expected a 500 error but did not receive one."));
      }
    });
  });
});
