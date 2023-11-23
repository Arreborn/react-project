import React, { useState } from "react";
import "./App.css";
import { Modal, Button, Form, FloatingLabel, Row } from "react-bootstrap";
import { useAuth } from "./AuthTokenContext.js";

function LoginForm({ show, onClose }) {
  const [formData, setFormData] = useState({
    firstname: "",
    surname: "",
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
  });
  const [errors, setErrors] = useState({});
  const { authenticate } = useAuth();

  const onEnterPress = (e) => {
    if (e.keyCode === 13 && e.shiftKey === false) {
      e.preventDefault();
      login();
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === "username") {
      newValue = value.toLowerCase();
    }

    setFormData((prevData) => ({ ...prevData, [name]: newValue }));
  };

  const sendLogin = async (thisUser) => {
    const response = await fetch("users/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(thisUser),
    });

    if (response.status == 200) {
      authenticate();
      onClose();
      return true;
    } else {
      console.error("Login failed:", await response.text());
      return false;
    }
  };

  const login = async () => {
    let validationErrors = {};

    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(formData.username)) {
      validationErrors.login = "Invalid username.";
    }

    if (Object.keys(validationErrors).length === 0) {
      const success = await sendLogin(formData);
      console.log(success);
      if (!success) {
        validationErrors.login = "Invalid credentials!";
        setErrors(validationErrors);
      }
    } else {
      setErrors(validationErrors);
    }
  };

  return (
    <>
      <Modal show={show} onHide={onClose}>
        <Modal.Header closeButton>
          <Modal.Title>Register</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onKeyDown={onEnterPress}>
            <Row>
              <Form.Group className="my-2 col-sm-6">
                <FloatingLabel
                  controlId="floatingInput"
                  label={errors.login ? errors.login : "Username"}
                  className={`mb-2 ${
                    errors.login ? "text-danger" : "text-dark"
                  }`}
                >
                  <Form.Control
                    name="username"
                    placeholder=""
                    value={formData.username}
                    onChange={handleInputChange}
                    isInvalid={errors.username}
                  />
                </FloatingLabel>
                <Form.Control.Feedback type="invalid">
                  {errors.username}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="my-2 col-sm-6">
                <FloatingLabel
                  controlId="floatingInput"
                  label={errors.login ? errors.login : "Password"}
                  className={`mb-2 ${
                    errors.login ? "text-danger" : "text-dark"
                  }`}
                >
                  <Form.Control
                    name="password"
                    type="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleInputChange}
                    isInvalid={errors.login}
                  />
                </FloatingLabel>
                <Form.Control.Feedback type="invalid">
                  {errors.login}
                </Form.Control.Feedback>
              </Form.Group>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={login}>
            Login
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default LoginForm;
