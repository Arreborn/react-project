import React, { useState, useContext } from "react";
import "./App.css";
import { Modal, Button, Form, FloatingLabel, Row } from "react-bootstrap";
import { useAuth } from "./AuthTokenContext.js";
import { OffcanvasContext } from "./OffcanvasProvider.js";

function Search({ show, onClose }) {
  const [formData, setFormData] = useState({
    search: "",
  });
  const [searchResults, setSearchResults] = useState([]);
  const { openUserPanel } = useContext(OffcanvasContext);

  const searchDone = (result) => {
    openUserPanel(result);
    onClose();
  };

  const onEnterPress = (e) => {
    if (e.keyCode === 13 && e.shiftKey === false) {
      e.preventDefault();
      search();
    }
  };

  const search = async () => {
    const search = formData.search;
    const response = await fetch(`/users/find/${search}`);
    const currentSearchResults = await response.json();
    setSearchResults(currentSearchResults);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let newValue = value.toLowerCase();

    setFormData((prevData) => ({ ...prevData, [name]: newValue }));
  };

  return (
    <>
      <Modal show={show} onHide={onClose}>
        <Modal.Header closeButton>
          <Modal.Title>Search</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onKeyDown={onEnterPress}>
            <Row>
              <Form.Group className="my-2 col-sm-12">
                <FloatingLabel
                  controlId="floatingSearchInput"
                  label={"Search for a twooter here..."}
                  className={"mb-2 text-dark"}
                >
                  <Form.Control
                    name="search"
                    placeholder=""
                    value={formData.search}
                    onChange={handleInputChange}
                  />
                </FloatingLabel>
                <Button
                  variant="primary"
                  style={{ width: "100%" }}
                  onClick={search}
                >
                  Search
                </Button>
                <hr></hr>
              </Form.Group>
            </Row>
            {searchResults.length > 0 && (
              <div>
                {searchResults.map((result) => (
                  <Button
                    key={result.uid}
                    style={{ width: "100%" }}
                    id={result.uid}
                    className="mb-1"
                    variant="primary"
                    onClick={() => searchDone(result)}
                  >
                    {result.name}
                  </Button>
                ))}
              </div>
            )}
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default Search;
