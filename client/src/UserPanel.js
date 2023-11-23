import React, { useState } from "react";
import { Card, Tabs, Tab } from "react-bootstrap";
import { useAuth } from "./AuthTokenContext.js";
import Friends from "./Friends.js";

function UserPanel() {
  const { friends } = useAuth();
  const [key, setKey] = useState("friends");

  return (
    <Card style={{ width: "100%", height: "100%" }}>
      <Card.Body>
        <Card.Title className="text-center">User Profile</Card.Title>
        <Card.Text>
          Here's where you would, in a perfect world, type in some kind of
          description or whatnot.
        </Card.Text>
        <Tabs
          id="user-panel-tabs"
          activeKey={key}
          onSelect={(k) => setKey(k)}
          className="mb-3 custom-tabs"
          fill
        >
          <Tab eventKey="profile" title="Profile">
            <p>Or maybe here. I don't know. I'm no designer.</p>
          </Tab>
          <Tab eventKey="friends" title="Friends">
            {friends.length === 0 ? (
              <p>No friends added yet!</p>
            ) : (
              friends.map((friend) => <Friends friend={friend} />)
            )}
          </Tab>
        </Tabs>
      </Card.Body>
    </Card>
  );
}

export default UserPanel;
