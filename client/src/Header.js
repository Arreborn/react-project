import { Container, Navbar, Button } from "react-bootstrap";
import React, { useState, useEffect, useContext } from "react";
import LoginForm from "./LoginForm.js";
import RegisterForm from "./RegisterForm.js";
import Search from "./Search.js";
import { useAuth } from "./AuthTokenContext.js";
import { OffcanvasContext } from "./OffcanvasProvider.js";
import PendingRequests from "./PendingRequests.js";

function Header({ refresh }) {
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPendingRequests, setShowPendingRequests] = useState(false);

  const { username, authenticate, friendRequests } = useAuth();
  const { openUserPanel } = useContext(OffcanvasContext);

  const [formData, setFormData] = useState({
    searchfield: "",
  });

  const openSearch = () => {
    setShowSearch(true);
  };

  const handleUserPanelClick = () => {
    openUserPanel();
  };

  const handleLoginButtonClick = () => {
    setShowLogin(true);
  };

  const handlePendingRequestsClick = () => {
    setShowPendingRequests(true);
  };

  const handleLogoutButtonClick = async () => {
    const response = await fetch("/logout", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.text();
      authenticate();
    } else {
      console.error("Error logging out:", response.statusText);
    }
  };

  const handleLoginClose = () => {
    setShowLogin(false);
  };

  const handleRegisterButtonClick = () => {
    setShowRegister(true);
  };

  const handleRegisterClose = () => {
    setShowRegister(false);
  };

  const handlePendingRequestsClose = () => {
    setShowPendingRequests(false);
  };

  const handleSearchClose = () => {
    setShowSearch(false);
  };

  useEffect(() => {
    authenticate();
  }, [refresh]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === "searchfield") {
      newValue = value.toLowerCase();
    }

    setFormData((prevData) => ({ ...prevData, [name]: newValue }));
  };

  return (
    <>
      <Search show={showSearch} onClose={handleSearchClose} />
      <LoginForm show={showLogin} onClose={handleLoginClose} />
      <RegisterForm show={showRegister} onClose={handleRegisterClose} />
      <PendingRequests
        show={showPendingRequests}
        onClose={handlePendingRequestsClose}
      />{" "}
      <Navbar className="top-layer">
        <Container className="navbar-dark">
          <Navbar.Brand href="/">Twooter</Navbar.Brand>
          {username ? (
            <a href="#" onClick={openSearch}>
              <img
                src={`${process.env.PUBLIC_URL}/search.png`}
                alt="Search Icon"
                style={{ width: "20px", height: "20px" }}
              />
            </a>
          ) : (
            <></>
          )}
          <Navbar.Toggle />
          <Navbar.Collapse className="justify-content-end">
            <Navbar.Text>
              {!username ? (
                <>
                  <Button
                    variant="primary"
                    className="mx-1"
                    onClick={handleLoginButtonClick}
                  >
                    Login
                  </Button>
                  <Button
                    variant="primary"
                    className="mx-1"
                    onClick={handleRegisterButtonClick}
                  >
                    Register
                  </Button>
                </>
              ) : (
                <>
                  {friendRequests.received &&
                    friendRequests.received.length > 0 && (
                      <Button
                        variant="warning"
                        className="mx-3"
                        onClick={handlePendingRequestsClick}
                      >
                        Pending Requests ({friendRequests.received.length})
                      </Button>
                    )}
                  Signed in as:{" "}
                  <a href="#" onClick={handleUserPanelClick}>
                    {username}
                  </a>
                  <Button
                    variant="primary"
                    className="mx-3"
                    onClick={handleLogoutButtonClick}
                  >
                    Logout
                  </Button>
                </>
              )}
            </Navbar.Text>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </>
  );
}

export default Header;
