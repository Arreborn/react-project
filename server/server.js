import { connectToDatabase, getDatabaseConnection } from "./mongoUtils.js";
import express from "express";
import jwt from "jsonwebtoken";
import { expressjwt } from "express-jwt";
import https from "https";
import fs from "fs";
import cors from "cors";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import { ObjectId } from "mongodb";

const app = express();

const AUTH_SEC = fs.readFileSync("keys/authtoken", "utf8");
const REFRESH_SEC = fs.readFileSync("keys/refreshtoken", "utf8");

const corsOptions = {
  origin: "https://localhost:3000",
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PATCH"],
  credentials: true,
};

// Middleware
app.use(express.json());
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(
  expressjwt({
    secret: AUTH_SEC,
    algorithms: ["HS256"],
    credentialsRequired: false,
  })
);

// If we want to play with HTTPS, here's the middleware
const privateKey = fs.readFileSync("../cert/key.pem", "utf8");
const certificate = fs.readFileSync("../cert/cert.pem", "utf8");
const credentials = { key: privateKey, cert: certificate };
const httpsServer = https.createServer(credentials, app);

console.log(process.env.NODE_ENV);
const isTestEnvironment = process.env.NODE_ENV == "test";
console.log("Test environment: " + isTestEnvironment);

let config = {
  host: "localhost:27017",
  db: isTestEnvironment ? "mongo-db-test" : "mongo-db", // Use a different DB for tests
};

/*
 * Middleware / helper functions
 */

let db;

connectToDatabase(config, () => {
  console.log("Connected to database");
  db = getDatabaseConnection();
});

// Middleware to validate JWT
// now with extra error logging!
const validateToken = async (req, res, next) => {
  const authToken = req.cookies.authToken;
  const refreshToken = req.cookies.refreshToken;

  if (!authToken && !refreshToken) {
    return res.status(401).send("No tokens provided");
  }

  try {
    const decoded = jwt.verify(authToken, AUTH_SEC);
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(decoded.userId) });

    if (!user) {
      console.error("User not found for authToken:", decoded.userId);
      return res.status(401).send("User not found");
    }

    req.user = {
      username: user.username,
      name: user.firstname,
      userId: user._id.toString(),
      friends: user.friends,
      friendRequests: user.friendRequests,
    };

    next();
  } catch (err) {
    console.error("Error verifying authToken:", err.message);

    if (refreshToken) {
      try {
        const decodedRefresh = jwt.verify(refreshToken, REFRESH_SEC);
        const user = await db
          .collection("users")
          .findOne({ _id: new ObjectId(decodedRefresh.userId) });

        if (!user) {
          console.error(
            "User not found for refreshToken:",
            decodedRefresh.userId
          );
          return res.status(401).send("User not found");
        }

        const newAuthToken = generateAuthToken(user);
        res.cookie("authToken", newAuthToken, { httpOnly: true });

        req.user = {
          username: user.username,
          name: user.firstname,
          userId: user.toString(),
          friends: user.friends,
        };
        next();
      } catch (err) {
        console.error("Error verifying refreshToken:", err.message);
        res.clearCookie("authToken");
        res.clearCookie("refreshToken");
        return res.status(401).send("Refresh token expired");
      }
    } else {
      return res.status(401).send("Auth token expired");
    }
  }
};

// Generate tokens
const generateAuthToken = (user) => {
  return jwt.sign(
    { userId: user._id, username: user.username, name: user.firstname },
    AUTH_SEC,
    {
      expiresIn: "15m",
    }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign({ userId: user._id, username: user.username }, REFRESH_SEC, {
    expiresIn: "7d",
  });
};

// This middleware validates the registration data
const validateRegistrationData = async (req, res, next) => {
  const { firstname, surname, username, password, confirmPassword, email } =
    req.body;

  if (firstname.length <= 1) {
    return res
      .status(400)
      .send("First name should be longer than one character.");
  }

  if (surname.length <= 1) {
    return res
      .status(400)
      .send("Last name should be longer than one character.");
  }

  if (username.length <= 3) {
    return res
      .status(400)
      .send("Username should be longer than three characters.");
  } else {
    const usernameAvailable = await db
      .collection("users")
      .findOne({ username: username });
    if (usernameAvailable) {
      return res.status(400).send("Username is already taken.");
    }
  }

  const passwordRegex = /^(?=.*\d{2,}).{8,}$/;
  if (!passwordRegex.test(password)) {
    return res
      .status(400)
      .send(
        "Password must be longer than 8 characters and contain at least two digits."
      );
  } else if (password !== confirmPassword) {
    return res.status(400).send("Passwords do not match.");
  }

  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).send("Please enter a valid email address.");
  }

  next(); // If all validations pass, move to finalize registration
};

// validates messges
function isValid(msg) {
  if (msg.recipient == null) {
    msg.recipient = msg.uid;
    msg.recipientName = "";
  }
  if (
    msg.name == null ||
    typeof msg.name != "string" ||
    msg.body == null ||
    typeof msg.body != "string" ||
    ObjectId.isValid(msg.uid) == false ||
    ObjectId.isValid(msg.recipient) == false ||
    typeof msg.recipientName != "string" ||
    Object.keys(msg).length != 5
  ) {
    return false;
  } else {
    return true;
  }
}

// starts a server
function startServer(port, callback) {
  return httpsServer.listen(port, () => {
    console.log(`HTTPS Server running on port ${port}`);
    callback && callback();
  });
}

/*
 *  Default index
 */

app.get("/", (req, res) => {
  res.status(200).send("Hello");
});

/*
 *  Message-routing
 */

app.get("/messages", async (req, res) => {
  try {
    let msg = await db.collection("posts").find().toArray();
    res.status(200).send(msg.reverse());
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/messages", async (req, res) => {
  let body = await req.body;
  if (!isValid(body)) {
    res.status(400).send("400");
  } else {
    let date = new Date();
    let formatted_date =
      String(date.getDate()).padStart(2, "0") +
      "/" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "/" +
      date.getFullYear() +
      " - " +
      String(date.getHours()).padStart(2, "0") +
      ":" +
      String(date.getMinutes()).padStart(2, "0");

    body["date"] = formatted_date;
    body["usersRead"] = [];
    let success = await db.collection("posts").insertOne(body);
    if (success.acknowledged) {
      res.status(200).send({ id: success.insertedId });
    } else {
      res.status(500).send("500");
    }
  }
});

/*
 * Messages-routing for specific ID
 */

app.get("/messages/:id", async (req, res) => {
  const id = req.params.id;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send("Invalid ID format");
  }

  let msg;
  try {
    msg = await db.collection("posts").findOne({ _id: new ObjectId(id) });
  } catch (error) {
    console.error("Error fetching message:", error);
    return res.status(500).send("Internal server error");
  }

  if (msg == null) {
    res.status(404).send("404");
  } else {
    res.status(200).send(msg);
  }
});

app.patch("/messages/:id", async (req, res) => {
  const id = req.params.id;

  if (!ObjectId.isValid(id)) {
    return res.status(400).send("Invalid ID format");
  }

  let msg;
  try {
    msg = await db.collection("posts").findOne({ _id: new ObjectId(id) });
  } catch (error) {
    console.error("Error fetching message:", error);
    return res.status(500).send("Internal server error");
  }

  if (
    msg == null ||
    req.body["read"] == null ||
    typeof req.body["read"] != "boolean" ||
    !req.body["id"] ||
    Object.keys(req.body).length != 2
  ) {
    return res.status(400).send("400");
  }

  let uid = req.body["id"];
  let usersRead = msg["usersRead"] || [];
  let index = usersRead.indexOf(uid);

  if (req.body["read"] && index === -1) {
    // Add uid to usersRead if it's not already present
    usersRead.push(uid);
  } else if (!req.body["read"] && index > -1) {
    // Remove uid from usersRead if it's present
    usersRead.splice(index, 1);
  }

  let success = await db
    .collection("posts")
    .updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { usersRead: usersRead } }
    );

  if (success.acknowledged) {
    res.status(200).send(req.body["read"] ? "true" : "false");
  } else {
    res.status(500).send("500");
  }
});

/*
 * Users-routing / login
 */

app.post("/users/check-availability", async (req, res) => {
  const { username, email } = req.body;

  if (!username && !email) {
    return res
      .status(400)
      .send({ error: "Provide a username or email to check." });
  }

  let response = {};

  if (username && typeof username == "string") {
    const userByUsername = await db.collection("users").findOne({ username });
    response.usernameAvailable = !userByUsername;
  }

  if (email && typeof email == "string") {
    const userByEmail = await db.collection("users").findOne({ email });
    response.emailAvailable = !userByEmail;
  }

  res.status(200).send(response);
});

app.post("/users/register", validateRegistrationData, async (req, res) => {
  if (req.cookies.authToken || req.cookies.refreshToken) {
    return res
      .status(400)
      .send("Already logged in. Cannot register while logged in.");
  }

  const { username, password, firstname, surname, email } = req.body;

  // make sure there is no injection
  if (
    username == null ||
    typeof username != "string" ||
    password == null ||
    typeof password != "string" ||
    firstname == null ||
    typeof firstname != "string" ||
    surname == null ||
    typeof surname != "string" ||
    email == null ||
    typeof email != "string"
  ) {
    // hard to reach due to validateRegistrationData
    return res.status(400).send("400");
  }

  // encrypt password
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  let user = await db.collection("users").insertOne({
    username,
    password: hash,
    firstname,
    surname,
    email,
    friends: [],
    friendRequests: { sent: [], received: [] },
  });

  const authToken = generateAuthToken({ username, _id: user.insertedId });
  const refreshToken = generateRefreshToken({ username, _id: user.insertedId });

  // Set both tokens as httponly cookies
  res.cookie("authToken", authToken, {
    httpOnly: true,
    secure: true,
    maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
    sameSite: "strict",
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    sameSite: "strict",
  });

  res.status(201).send("201");
});

app.post("/users/login", async (req, res) => {
  if (req.cookies.authToken || req.cookies.refreshToken) {
    return res.status(400).send("Already logged in.");
  }

  const { username, password } = req.body;

  if (
    username == null ||
    typeof username != "string" ||
    password == null ||
    typeof password != "string"
  ) {
    return res.status(401).send("Invalid credentials.");
  }

  const user = await db.collection("users").findOne({ username: username });

  if (!user) {
    return res.status(401).send("Invalid username or password");
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password);
  if (!isPasswordValid) {
    return res.status(401).send("Invalid username or password");
  }

  const authToken = generateAuthToken(user);
  const refreshToken = generateRefreshToken(user);

  // Set both tokens as httponly cookies
  res.cookie("authToken", authToken, {
    httpOnly: true,
    secure: true,
    maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
    sameSite: "strict",
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    sameSite: "strict",
  });

  res.status(200).send({ username });
});

app.get("/users/:uid", async (req, res) => {
  const uid = req.params.uid;

  if (!ObjectId.isValid(uid)) {
    return res.status(400).send("Invalid UID format");
  }

  try {
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(uid) });

    if (!user) {
      return res.status(404).send("User not found");
    }

    res.status(200).send({
      username: user.username,
      friends: user.friends,
      friendRequests: user.friendRequests,
      name: user.firstname,
      uid: user._id.toString(),
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/validate", validateToken, (req, res) => {
  res.send({
    username: req.user.username,
    uid: req.user.userId,
    name: req.user.name,
    friends: req.user.friends,
    friendRequests: req.user.friendRequests,
  });
});

app.post("/logout", (req, res) => {
  res.clearCookie("authToken");
  res.clearCookie("refreshToken");
  res.status(200).send("Logged out successfully");
});

/*
 * Friends-routing
 */

app.post("/users/friends/request", validateToken, async (req, res) => {
  const { uid, friendID } = req.body;

  if (!uid || !friendID) {
    return res.status(400).send("Both your uid and friends uid are required.");
  }

  if (uid === friendID) {
    return res.status(400).send("Cannot send friend request to yourself.");
  }

  try {
    const sender = await db
      .collection("users")
      .findOne({ _id: new ObjectId(uid) });

    const receiver = await db
      .collection("users")
      .findOne({ _id: new ObjectId(friendID) });

    if (!sender || !receiver) {
      return res.status(404).send("User or friend not found.");
    }

    if (sender.friends && sender.friends.includes(friendID)) {
      return res.status(400).send("Already friends!");
    }

    if (sender.friendRequests.sent.includes(friendID)) {
      return res.status(400).send("Friend request pending!");
    }

    // update the requester's sent array
    await db
      .collection("users")
      .updateOne(
        { _id: new ObjectId(uid) },
        { $push: { "friendRequests.sent": friendID } }
      );

    // update the receiver's received array
    await db
      .collection("users")
      .updateOne(
        { _id: new ObjectId(friendID) },
        { $push: { "friendRequests.received": uid } }
      );

    res.status(200).send("Friend request sent successfully.");
  } catch (error) {
    console.error("Error sending friend request:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/users/friends/accept", validateToken, async (req, res) => {
  const { uid, requesterID } = req.body;

  if (!uid || !requesterID) {
    return res
      .status(400)
      .send("Both your uid and requesters uid are required.");
  }

  if (uid === requesterID) {
    return res.status(400).send("Cannot accept friend request from yourself.");
  }

  try {
    const accepter = await db
      .collection("users")
      .findOne({ _id: new ObjectId(uid) });

    const requester = await db
      .collection("users")
      .findOne({ _id: new ObjectId(requesterID) });

    if (!accepter || !requester) {
      return res.status(404).send("User or requester not found.");
    }

    if (accepter.friends && accepter.friends.includes(requesterID)) {
      return res.status(400).send("Already friends.");
    }

    if (!accepter.friendRequests.received.includes(requesterID)) {
      return res.status(400).send("No friend request to accept.");
    }

    // update the user's friends and received arrays
    await db.collection("users").updateOne(
      { _id: new ObjectId(uid) },
      {
        $push: { friends: requesterID },
        $pull: { "friendRequests.received": requesterID },
      }
    );

    // update the requester's friends and sent arrays
    await db.collection("users").updateOne(
      { _id: new ObjectId(requesterID) },
      {
        $push: { friends: uid },
        $pull: { "friendRequests.sent": uid },
      }
    );

    res.status(200).send("Friend request accepted successfully.");
  } catch (error) {
    console.error("Error accepting friend request:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/users/friends/decline", validateToken, async (req, res) => {
  const { uid, requesterID } = req.body;

  if (!uid || !requesterID) {
    return res
      .status(400)
      .send("Both your uid and requester's uid are required.");
  }

  if (uid === requesterID) {
    return res.status(400).send("Cannot decline friend request from yourself.");
  }

  try {
    const accepter = await db
      .collection("users")
      .findOne({ _id: new ObjectId(uid) });

    const requester = await db
      .collection("users")
      .findOne({ _id: new ObjectId(requesterID) });

    if (!accepter || !requester) {
      return res.status(404).send("User or requester not found.");
    }

    if (!accepter.friendRequests.received.includes(requesterID)) {
      return res.status(400).send("No friend request to decline.");
    }

    // update the user's received arrays
    await db.collection("users").updateOne(
      { _id: new ObjectId(uid) },
      {
        $pull: { "friendRequests.received": requesterID },
      }
    );

    // update the requester's sent arrays
    await db.collection("users").updateOne(
      { _id: new ObjectId(requesterID) },
      {
        $pull: { "friendRequests.sent": uid },
      }
    );

    res.status(200).send("Friend request declined successfully.");
  } catch (error) {
    console.error("Error declining friend request:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/users/friends/remove", validateToken, async (req, res) => {
  const { uid, friendID } = req.body;

  if (!uid || !friendID) {
    return res.status(400).send("Both uid and friendID are required.");
  }

  try {
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(uid) });

    const friend = await db
      .collection("users")
      .findOne({ _id: new ObjectId(friendID) });

    if (!user || !friend) {
      return res.status(404).send("User not found.");
    }

    if (
      !user.friends ||
      !user.friends.includes(friendID) ||
      !friend.friends ||
      !friend.friends.includes(uid)
    ) {
      return res.status(400).send("User not found in friend list.");
    }

    const userUpdatedFriendsList = user.friends.filter(
      (friend) => friend !== friendID
    );

    const friendUpdatedFriendsList = friend.friends.filter(
      (user) => user !== uid
    );

    await db
      .collection("users")
      .updateOne(
        { _id: new ObjectId(uid) },
        { $set: { friends: userUpdatedFriendsList } }
      );

    await db
      .collection("users")
      .updateOne(
        { _id: new ObjectId(friendID) },
        { $set: { friends: friendUpdatedFriendsList } }
      );

    res.status(200).send("Friend removed successfully.");
  } catch (error) {
    console.error("Error removing friend:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/users/find/:text?", validateToken, async (req, res) => {
  const searchText = req.params.text;

  if (searchText && typeof searchText === "string") {
    const users = await db.collection("users").find().toArray();
    let matches = [];

    for (let i in users) {
      const user = users[i];
      if (
        user.username.includes(searchText) &&
        user.username !== req.user.username
      ) {
        matches.push({ name: user.username, uid: user._id.toString() });
      }
    }
    res.status(200).send(matches);
  } else {
    // this path is caught by /users/uid, and gives the same code but incorrect status
    res.status(400).send("Invalid search text.");
  }
});

/*
 * Trigger error
 */
app.get("/trigger-error", (req, res, next) => {
  const err = new Error("I made an oopsie! :(");
  next(err);
});

/*
 * Error-handling
 */
app.get("*", (req, res) => {
  res.status(404).send("404");
});

app.use("/", (req, res, next) => {
  res.status(405).send("405");
});

export { startServer };
