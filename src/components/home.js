// Home.js
import React from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import GoogleMap from "./GoogleMap"; // 追加

function Home() {
  const navigate = useNavigate();

  const logout = async () => {
    await signOut(auth);
    navigate("/"); // ログアウト後はログイン・登録画面へ
  };

  const myprofile = () => {
    navigate("/editprofile"); // マイプロフィール画面への遷移（小文字に統一）
  };

  const reviewpost = () => {
    navigate("/reviewpost"); // レビュー投稿画面への遷移（小文字に統一）
  };

  return (
    <div>
      <h1>GochiSpace</h1>
      
      <GoogleMap /> {/* Google Mapを表示 */}
      <button onClick={logout}>ログアウト</button>
      <button onClick={myprofile}>マイプロフィール</button>
      <button onClick={reviewpost}>レビュー投稿</button>
    </div>
  );
}

export default Home;
