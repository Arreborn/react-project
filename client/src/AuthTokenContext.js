import React, { useState, createContext, useContext, useEffect } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [username, setUsername] = useState(null);
  const [name, setName] = useState(null);
  const [uid, setUid] = useState(null);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState({});

  const authenticate = async () => {
    try {
      const response = await fetch("/validate", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setUsername(data.username);
        setName(data.name);
        setUid(data.uid);
        setFriends(data.friends ? data.friends : []);
        setFriendRequests(data.friendRequests ? data.friendRequests : {});
      } else {
        console.error("Error validating user:", response.statusText);
        setUsername(null);
        setName(null);
        setUid(null);
        setFriends([]);
        setFriendRequests({});
        await fetch("/logout", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });
        return false;
      }
    } catch (error) {
      console.error("Error validating user:", error);
      setUsername(null);
      setName(null);
      setUid(null);
      setFriends([]);
      setFriendRequests({});
      await fetch("/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      return false;
    }
    return true;
  };

  useEffect(() => {
    authenticate();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        username,
        name,
        uid,
        authenticate,
        setUsername,
        friends,
        friendRequests,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
