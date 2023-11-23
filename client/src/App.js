import React, { useState, useEffect } from "react";
import "./App.css";
import Header from "./Header.js";
import Messages from "./Messages.js";
import { AuthProvider } from "./AuthTokenContext.js";
import { OffcanvasProvider } from "./OffcanvasProvider.js";
import OffcanvasComponent from "./OffcanvasComponent.js";

function App() {
  const [refreshCount, setRefreshCount] = useState(false);

  const update = () => {
    if (refreshCount === 0) {
      setRefreshCount(1);
    } else {
      setRefreshCount(refreshCount + 1);
    }
  };

  useEffect(() => {}, [refreshCount]);

  return (
    <AuthProvider>
      <OffcanvasProvider>
        <Header update={update} refresh={refreshCount} />
        <Messages update={update} refresh={refreshCount} />
        <OffcanvasComponent />
      </OffcanvasProvider>
    </AuthProvider>
  );
}

export default App;
