import { useContext } from "react";
import { Offcanvas, Button } from "react-bootstrap";
import { OffcanvasContext } from "./OffcanvasProvider.js";
import { useAuth } from "./AuthTokenContext.js";

function OffcanvasComponent() {
  const { show, setShow, content } = useContext(OffcanvasContext);
  const { username, name, uid, authenticate, setUsername, friends } = useAuth();

  return (
    <Offcanvas
      placement="end"
      show={show}
      onHide={() => setShow(false)}
      scroll={false}
      backdrop={true}
    >
      <Offcanvas.Header closeButton className="mt-3"></Offcanvas.Header>
      <Offcanvas.Body>{content}</Offcanvas.Body>
    </Offcanvas>
  );
}

export default OffcanvasComponent;
