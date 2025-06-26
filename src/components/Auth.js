import React, { useState } from "react";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";

function Auth() {
  const [isRegister, setIsRegister] = useState(false); // false:ログイン, true:登録
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleAuth = async () => {
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("ユーザー登録が完了しました");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        alert("ログイン成功");
      }
      navigate("/home");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div>
      <h1>{isRegister ? "ユーザー登録" : "ログイン"}</h1>
      <input
        type="email"
        placeholder="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      /><br/>
      <input
        type="password"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      /><br/>
      <button onClick={handleAuth}>{isRegister ? "登録" : "ログイン"}</button>
      <br />
      <button onClick={() => setIsRegister(!isRegister)}>
        {isRegister ? "ログイン画面へ" : "初めての方はこちら（ユーザー登録）"}
      </button>
    </div>
  );
}

export default Auth;