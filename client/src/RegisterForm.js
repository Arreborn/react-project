import React, { useState } from "react";
import "./App.css";
import { Modal, Button, Form, Row, FloatingLabel } from "react-bootstrap";
import { AuthProvider, useAuth } from "./AuthTokenContext.js";

function RegisterForm({ show, onClose, onSuccess }) {
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

  const sendRegister = async (thisUser) => {
    const response = await fetch("/users/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(thisUser),
    });

    if (response.status == 201) {
      authenticate();
      onClose();
    } else {
      // Handle error
      console.error("Registration failed:", await response.text());
    }
  };

  const checkAvailability = async (username, email) => {
    try {
      const response = await fetch("/users/check-availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          usernameAvailable: data.usernameAvailable,
          emailAvailable: data.emailAvailable,
        };
      } else {
        throw new Error("Failed to check availability");
      }
    } catch (error) {
      console.error("Error checking availability:", error);
      return null;
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

  const validate = async () => {
    let validationErrors = {};

    if (formData.firstname.length <= 1) {
      validationErrors.firstname = "Invalid name!";
    }

    if (formData.surname.length <= 1) {
      validationErrors.surname = "Invalid name!";
    }

    const usernameRegex = /^[a-zA-Z0-9_-]+$/;

    if (formData.username.length <= 3) {
      validationErrors.username = "Username too short!";
    } else if (!usernameRegex.test(formData.username)) {
      validationErrors.username = "Invalid characters in username!";
    } else {
      const isAvailable = await checkAvailability(formData.username, null);
      if (!isAvailable) {
        validationErrors.username = "Username is already taken!";
      }
    }

    const passwordRegex = /^(?=.*\d{2,}).{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      validationErrors.password = "Invalid password! ";
    } else if (formData.password !== formData.confirmPassword) {
      validationErrors.confirmPassword = "Passwords do not match!";
    }

    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(formData.email)) {
      validationErrors.email = "Invalid e-mail!";
    } else {
      const isAvailable = await checkAvailability(null, formData.email);
      if (!isAvailable) {
        validationErrors.email = "Email is already taken!";
      }
    }

    if (Object.keys(validationErrors).length === 0) {
      sendRegister(formData);
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
          <Form>
            <Row>
              <Form.Group className="my-2 col-sm-6">
                <FloatingLabel
                  controlId="floatingInput"
                  label={errors.firstname ? errors.firstname : "First name"}
                  className={`mb-2 ${
                    errors.firstname ? "text-danger" : "text-dark"
                  }`}
                >
                  <Form.Control
                    name="firstname"
                    placeholder=""
                    value={formData.firstname}
                    onChange={handleInputChange}
                    isInvalid={errors.firstname}
                  />
                </FloatingLabel>
              </Form.Group>

              <Form.Group className="my-2 col-sm-6">
                <FloatingLabel
                  controlId="floatingInput"
                  label={errors.firstname ? errors.surname : "Last name"}
                  className={`mb-2 ${
                    errors.surname ? "text-danger" : "text-dark"
                  }`}
                >
                  <Form.Control
                    name="surname"
                    placeholder=""
                    value={formData.surname}
                    onChange={handleInputChange}
                    isInvalid={errors.surname}
                  />
                </FloatingLabel>
              </Form.Group>
            </Row>

            <Row>
              <Form.Group className="my-2 col-sm-12">
                <FloatingLabel
                  controlId="floatingInput"
                  label={errors.username ? errors.username : "Username"}
                  className={`mb-2 ${
                    errors.username ? "text-danger" : "text-dark"
                  }`}
                >
                  <Form.Control
                    name="username"
                    placeholder="Username"
                    value={formData.username}
                    onChange={handleInputChange}
                    isInvalid={errors.username}
                  />
                </FloatingLabel>
              </Form.Group>
              <p>
                Password must contain at least two digits, and may only consist
                of letters, numbers, underscores and hyphens.
              </p>
            </Row>

            <Row>
              <Form.Group className="mb-2 col-sm-6">
                <FloatingLabel
                  controlId="floatingInput"
                  label={errors.password ? errors.password : "Password"}
                  className={`mb-2 ${
                    errors.password ? "text-danger" : "text-dark"
                  }`}
                >
                  <Form.Control
                    name="password"
                    type="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleInputChange}
                    isInvalid={errors.password}
                  />
                </FloatingLabel>
              </Form.Group>

              <Form.Group className="mb-2 col-sm-6">
                <FloatingLabel
                  controlId="floatingInput"
                  label={
                    errors.confirmPassword
                      ? errors.confirmPassword
                      : "Repeat password"
                  }
                  className={`mb-2 ${
                    errors.confirmPassword ? "text-danger" : "text-dark"
                  }`}
                >
                  <Form.Control
                    name="confirmPassword"
                    type="password"
                    placeholder="Repeat your password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    isInvalid={errors.confirmPassword}
                  />
                </FloatingLabel>
              </Form.Group>
            </Row>

            <Row>
              <Form.Group className="my-2 col-sm-12">
                <FloatingLabel
                  controlId="floatingInput"
                  label={errors.email ? errors.email : "E-mail"}
                  className={`mb-2 ${
                    errors.email ? "text-danger" : "text-dark"
                  }`}
                >
                  <Form.Control
                    name="email"
                    type="email"
                    placeholder="E-mail"
                    value={formData.email}
                    onChange={handleInputChange}
                    isInvalid={errors.email}
                  />
                </FloatingLabel>
              </Form.Group>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={validate}>
            Register
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default RegisterForm;
