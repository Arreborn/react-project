import React, { useState, useEffect, useContext } from "react";
import { Card, Form, Row, Col } from "react-bootstrap";
import { useAuth } from "./AuthTokenContext.js";
import { OffcanvasContext } from "./OffcanvasProvider.js";

function SingleMessage({ message }) {
  const { username, uid } = useAuth();
  const { openUserPanel } = useContext(OffcanvasContext);
  const [read, setRead] = useState(
    message.usersRead && message.usersRead.includes(uid)
  );

  useEffect(() => {
    setRead(message.usersRead && message.usersRead.includes(uid));
  });

  const readChange = async () => {
    const response = await fetch(`/messages/${message._id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ read: !read, id: uid }),
    });

    const result = await response.text();
    if (response.ok) {
      let status = result === "true";
      setRead(status);
      let index = message.usersRead.indexOf(uid);

      if (index > -1) {
        // Remove uid from usersRead if it's present
        message.usersRead.splice(index, 1);
      } else {
        message.usersRead.push(uid);
      }
    }
  };

  return (
    <Card className="mb-2">
      <Card.Header className={read ? "post_read fw_bold" : "fw_bold smooth"}>
        {uid && uid !== message.uid ? (
          <>
            <a
              className="user-link"
              href="#"
              onClick={() =>
                openUserPanel({ uid: message.uid, name: message.name })
              }
            >
              {message.name}
            </a>
            {message.recipient && message.uid !== message.recipient ? (
              <span>
                {" -> "}

                {message.recipientName}
              </span>
            ) : null}
          </>
        ) : (
          <>
            {message.name}
            {message.recipient && message.uid !== message.recipient ? (
              <span>
                {" -> "}
                <a
                  className="user-link"
                  href="#"
                  onClick={() =>
                    openUserPanel({
                      uid: message.recipient,
                      name: message.recipientName,
                    })
                  }
                >
                  {message.recipientName}
                </a>
              </span>
            ) : null}
          </>
        )}
      </Card.Header>
      <Card.Body>
        <Card.Text>{message.body}</Card.Text>
      </Card.Body>
      <Card.Footer
        className={
          read
            ? "post_read d-flex justify-content-between"
            : "d-flex justify-content-between smooth"
        }
      >
        <span className="pt-2">{message.date}</span>
        <Form.Group as={Row} className="mb-0">
          {username && username != message.name ? (
            <>
              <Form.Label column sm="6" className="pe-1">
                Read
              </Form.Label>
              <Col sm="6">
                <Form.Check
                  type="switch"
                  checked={read}
                  className="pt-1"
                  onChange={readChange}
                />
              </Col>
            </>
          ) : (
            <></>
          )}
        </Form.Group>
      </Card.Footer>
    </Card>
  );
}

export default SingleMessage;
