// Home.js
import React from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  const logout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div>
      <h1>ホーム画面</h1>
      <button onClick={logout}>ログアウト</button>
    </div>
  );
}

export default Home;
