import React, { useState, useEffect } from "react";
import { Modal, ListGroup, Button, Card } from "react-bootstrap";
import { useAuth } from "./AuthTokenContext.js";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import "./Animation.css";

function PendingRequests({ show, onClose }) {
  const { friendRequests, authenticate, uid } = useAuth();
  const [usernames, setUsernames] = useState([]);

  useEffect(() => {
    async function fetchUsernames() {
      const names = await Promise.all(
        friendRequests.received.map((uid) => getUsername(uid))
      );
      setUsernames(names);
    }

    if (friendRequests.received && friendRequests.received.length > 0) {
      fetchUsernames();
    }
  }, [friendRequests]);

  const getUsername = async (uid) => {
    const response = await fetch(`/users/${uid}`);
    const body = await response.json();
    if (response.status !== 200) {
      throw Error(body.message);
    }
    return body.username;
  };

  const handleAccept = async (requesterID) => {
    const response = await fetch("/users/friends/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uid, requesterID }),
    });

    if (response.ok) {
      authenticate();
      onClose();
    } else {
      console.error("Error accepting friend request:", response.statusText);
    }
  };

  const handleDecline = async (requesterID) => {
    const response = await fetch("/users/friends/decline", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uid, requesterID }),
    });

    if (response.ok) {
      authenticate();
      onClose();
    } else {
      console.error("Error declining friend request:", response.statusText);
    }
  };

  return (
    <Modal show={show} onHide={onClose}>
      <Modal.Header closeButton>
        <Modal.Title>Pending Friend Requests</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <TransitionGroup component={ListGroup}>
          {usernames.map((name, index) => (
            <CSSTransition key={index} timeout={300} classNames="slide-up">
              <Card>
                <Card.Body>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>{name}</span>
                    <div>
                      <Button
                        variant="success"
                        className="ms-2"
                        onClick={() =>
                          handleAccept(friendRequests.received[index])
                        }
                      >
                        ✓
                      </Button>
                      <Button
                        variant="danger"
                        className="ms-2"
                        onClick={() =>
                          handleDecline(friendRequests.received[index])
                        }
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </CSSTransition>
          ))}
        </TransitionGroup>
      </Modal.Body>
    </Modal>
  );
}

export default PendingRequests;
