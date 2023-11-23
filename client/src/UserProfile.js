import React, { useState, useEffect } from "react";
import { Card, Button } from "react-bootstrap";
import { useAuth } from "./AuthTokenContext.js";

function UserProfile({ thisUser }) {
  console.log("thisUser: ", thisUser);
  const { uid, friends, friendRequests } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isFriendRequestSent, setIsFriendRequestSent] = useState(
    friendRequests.sent.includes(thisUser.uid)
  );

  const [isFriend, setIsFriend] = useState(friends.includes(thisUser.uid));

  useEffect(() => {
    const getMessages = async () => {
      try {
        const response = await fetch("/messages");
        if (response.status !== 200) {
          throw new Error("Failed to fetch messages");
        }
        const data = await response.json();
        setMessages(data.messages);
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };
    getMessages();
  });

  const sendFriendRequest = async (receiverUid) => {
    try {
      const response = await fetch("/users/friends/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uid, friendID: receiverUid }),
      });

      if (response.status !== 200) {
        throw new Error(await response.text());
      }

      console.log("Friend request sent successfully!");
      setIsFriendRequestSent(true);
    } catch (error) {
      console.error("Error sending friend request:", error);
    }
  };

  console.log(friendRequests.received.includes(thisUser.uid));

  return (
    <Card style={{ width: "100%", height: "100%" }}>
      <Card.Body>
        <Card.Title className="text-center">{thisUser.name}</Card.Title>
        <Card.Text>
          Here's where you would, in a perfect world, type in some kind of
          description or whatnot.
        </Card.Text>
        <Button
          variant="primary"
          className="pb-1"
          style={{ width: "100%" }}
          onClick={() => sendFriendRequest(thisUser.uid)}
          disabled={
            isFriendRequestSent ||
            isFriend ||
            friendRequests.received.includes(thisUser.uid)
          }
        >
          {isFriendRequestSent
            ? "Request Sent"
            : isFriend
            ? "Already friends"
            : friendRequests.received.includes(thisUser.uid)
            ? "Friend request pending"
            : "Add Friend"}
        </Button>
      </Card.Body>
    </Card>
  );
}

export default UserProfile;
