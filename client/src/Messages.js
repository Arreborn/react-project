import React, { useState, useEffect } from "react";
import { CSSTransition } from "react-transition-group";
import {
  Container,
  Row,
  Col,
  Button,
  FloatingLabel,
  Form,
  Pagination,
  Toast,
} from "react-bootstrap";
import "./App.css";
import "./Animation.css";
import SingleMessage from "./SingleMessage.js";
import { useAuth, uid } from "./AuthTokenContext.js";

function Messages({ update, refresh }) {
  // user state
  const { username, name, uid, authenticate, friends } = useAuth();

  // states for messages
  const [messages, setMessages] = useState([]);
  const [messageData, setFormData] = useState({
    message: "",
  });
  const [errors, setErrors] = useState({});

  // state for recipient
  const [selectedFriend, setSelectedFriend] = useState(uid); // default to the user's own uid
  const [selectedFriendName, setSelectedFriendName] = useState(null);
  const [friendsNames, setFriendsNames] = useState([]);

  // state for toast
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const fetchFriendsNames = async () => {
    const names = await Promise.all(friends.map((uid) => getUsername(uid)));
    setFriendsNames(names);
  };

  useEffect(() => {
    if (friends.length) {
      fetchFriendsNames();
    }
  }, [friends]);

  useEffect(() => {
    if (!uid) {
      setMessages([]);
    } else {
      fetchData();
    }
  }, [uid, friends]);

  // for pagination
  const [currentPageMyPosts, setCurrentPageMyPosts] = useState(1);
  const messagesPerPage = 5;

  // makes the pagination logic reusable
  const renderPaginatedMessages = (messages, currentPage, setCurrentPage) => {
    const totalPages = Math.ceil(messages.length / messagesPerPage);
    const currentMessages = messages.slice(
      (currentPage - 1) * messagesPerPage,
      currentPage * messagesPerPage
    );

    return (
      <>
        {currentMessages && currentMessages.length > 0 ? (
          currentMessages.map((message, index) => (
            <SingleMessage message={message} />
          ))
        ) : (
          <p className="text-center">No messages!</p>
        )}

        <Pagination>
          {[...Array(totalPages).keys()].map((page) => (
            <>
              <Pagination.Item
                key={page + 1}
                active={page + 1 === currentPage}
                onClick={() => setCurrentPage(page + 1)}
                className="mt-1"
              >
                {page + 1}
              </Pagination.Item>
            </>
          ))}
        </Pagination>
      </>
    );
  };

  const validatePost = (text) => {
    if (!text.trim()) {
      setErrors({ messages: "Post cannot be empty!" });
      return false;
    } else if (text.length > 140) {
      setErrors({ messages: "Message is too long!" });
      return false;
    } else {
      setErrors({});
      return true;
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (value.length == 0) {
      setErrors({ messages: "Post cannot be empty!" });
    } else if (value.length > 140) {
      setErrors({ messages: "Message is too long!" });
    } else {
      let newValue = value;
      setErrors({});
      setFormData((prevData) => ({ ...prevData, [name]: newValue }));
    }
  };

  const getMessages = async () => {
    const response = await fetch("/messages");
    const body = await response.json();
    if (response.status !== 200) {
      throw Error(body.message);
    }
    return body;
  };

  const getUsername = async (uid) => {
    const response = await fetch(`/users/${uid}`);
    const body = await response.json();
    if (response.status !== 200) {
      throw Error(body.message);
    }
    return body.username;
  };

  async function fetchData() {
    const result = await getMessages();
    const updatedMessages = result.filter(
      (message) => uid === message.recipient || friends.includes(message.uid)
    );
    setMessages(updatedMessages);
  }

  useEffect(() => {
    fetchData();
  }, [refresh]);

  const sendPost = async () => {
    const postContent = messageData.message;

    if (!validatePost(postContent) || !authenticate()) {
      return;
    }

    let thisPost = {
      name: username,
      body: postContent.trim(),
      uid: uid,
      recipient: selectedFriend === uid ? null : selectedFriend,
      recipientName: selectedFriendName,
    };

    const response = await fetch("/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(thisPost),
    });

    if (response.status == 200) {
      const success = await getMessages();
      setFormData({ message: "" });
      setToastMessage("Post sent successfully!");
      setShowToast(true);
      setMessages(success);
    } else {
      setToastMessage("Error sending post!");
      setShowToast(true);
    }
  };

  return (
    <Container as="article">
      <CSSTransition
        in={!!username}
        timeout={300}
        classNames="slide"
        unmountOnExit
      >
        <header>
          <h2 className="text-center mt-2 middle-layer">Welcome, {name}!</h2>
        </header>
      </CSSTransition>
      <Row className="input-group">
        <>
          <CSSTransition
            in={!!username}
            timeout={300}
            classNames="slide"
            unmountOnExit
          >
            <>
              <Col sm={10} className="mt-2 middle-layer">
                {friends.length > 0 && (
                  <Form.Select
                    aria-label="Select a friend"
                    onChange={(e) => {
                      setSelectedFriend(e.target.value);
                      setSelectedFriendName(
                        e.target.options[e.target.selectedIndex].text
                      );
                    }}
                    className="mb-2"
                  >
                    <option value={uid}>Send a message to...</option>
                    {friends.map((friendUID, index) => (
                      <option key={friendUID} value={friendUID}>
                        {friendsNames[index]}
                      </option>
                    ))}
                  </Form.Select>
                )}
                <FloatingLabel
                  controlId="floatingInput"
                  label={
                    errors.messages
                      ? errors.messages
                      : selectedFriendName &&
                        selectedFriendName !== "Send a message to..."
                      ? `Hoot a twoot to your pal ${selectedFriendName}...`
                      : "Twoot your hoots out here..."
                  }
                  className={`mb-0 ${
                    errors.messages ? "text-danger" : "text-dark"
                  }`}
                >
                  <Form.Control
                    name="message"
                    placeholder=""
                    style={{ resize: "none" }}
                    value={messageData.messages}
                    onChange={handleInputChange}
                    isInvalid={errors.message}
                  />
                </FloatingLabel>
              </Col>
            </>
          </CSSTransition>
          <CSSTransition
            in={!!username}
            timeout={300}
            classNames="slide"
            unmountOnExit
          >
            <Col sm={2} className="mt-2 middle-layer">
              <Button
                id="send_btn"
                onClick={sendPost}
                className={errors.messages ? "disabled" : ""}
              >
                Post
              </Button>
            </Col>
          </CSSTransition>
        </>
        {username ? (
          <>
            <CSSTransition
              in={!!username}
              timeout={300}
              classNames="slide"
              unmountOnExit
            >
              <Col sm={12} className="mt-4 middle-layer">
                <Button
                  className="mb-2"
                  style={{ width: "100%" }}
                  onClick={() => update()}
                >
                  Refresh
                </Button>
                {renderPaginatedMessages(
                  messages,
                  currentPageMyPosts,
                  setCurrentPageMyPosts
                )}
              </Col>
            </CSSTransition>
          </>
        ) : (
          <>
            <CSSTransition
              in={!!username}
              timeout={300}
              classNames="slide"
              unmountOnExit
            >
              <Col sm={12} className="mt-2 middle-layer">
                <p className="mt-2 text-center">
                  Be a doll and log in if you want to play!
                </p>
              </Col>
            </CSSTransition>
          </>
        )}
      </Row>
      <Toast
        style={{
          position: "absolute",
          bottom: 10,
          left: 10,
        }}
        onClose={() => setShowToast(false)}
        show={showToast}
        delay={10000} // 10 seconds
        autohide
      >
        <Toast.Header>
          <strong className="me-auto top-layer">Notification</strong>
        </Toast.Header>
        <Toast.Body>{toastMessage}</Toast.Body>
      </Toast>
    </Container>
  );
}

export default Messages;
