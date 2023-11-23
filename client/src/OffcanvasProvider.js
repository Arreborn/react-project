import React, { createContext, useState, useContext } from "react";
import UserPanel from "./UserPanel.js";
import UserProfile from "./UserProfile.js";
import { useAuth } from "./AuthTokenContext.js";

export const OffcanvasContext = createContext();

export const OffcanvasProvider = ({ children }) => {
  const [show, setShow] = useState(false);
  const [content, setContent] = useState(null);
  const { authenticate } = useAuth();

  const openUserPanel = async (uid = null) => {
    if (!(await authenticate())) {
      return;
    }

    if (show) {
      setShow(!show);
    } else {
      if (uid) {
        setContent(<UserProfile thisUser={uid} />);
        setShow(!show);
      } else {
        setContent(<UserPanel />);
        setShow(!show);
      }
    }
  };

  return (
    <OffcanvasContext.Provider
      value={{ show, setShow, content, setContent, openUserPanel }}
    >
      {children}
    </OffcanvasContext.Provider>
  );
};
