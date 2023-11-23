import React, { useState, useEffect } from "react";
import { Card, Button, Modal } from "react-bootstrap";
import { useAuth } from "./AuthTokenContext.js";

const Friends = ({ friend }) => {
  const [showModal, setShowModal] = useState(false);
  const { uid, authenticate } = useAuth();

  const getUsername = async (uid) => {
    const response = await fetch(`/users/${uid}`);
    const body = await response.json();
    if (response.status !== 200) {
      throw Error(body.message);
    }
    return body.username;
  };

  const [thisUser, setThisUser] = useState(null);

  useEffect(() => {
    async function fetchUsername() {
      try {
        const fetchedUsername = await getUsername(friend);
        setThisUser(fetchedUsername);
      } catch (error) {
        console.error("Error fetching username:", error);
      }
    }

    fetchUsername();
  }, []);

  const handleRemoveFriend = async () => {
    try {
      const response = await fetch("/users/friends/remove/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: uid,
          friendID: friend,
        }),
      });

      if (response.status === 200) {
        authenticate();
      } else {
        console.error("Failed to remove friend. Status:", response.status);
      }
    } catch (error) {
      console.error("Error removing friend:", error);
    }

    setShowModal(false);
  };

  return (
    <>
      <Card>
        <Card.Body className="d-flex justify-content-between align-items-center">
          <div>{thisUser}</div>
          <Button variant="danger" onClick={() => setShowModal(true)}>
            X
          </Button>
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Unfriend {thisUser}</Modal.Title>{" "}
        </Modal.Header>
        <Modal.Body>Are you sure you want to unfriend {thisUser}?</Modal.Body>{" "}
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRemoveFriend}>
            Remove
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Friends;
