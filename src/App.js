import Login from "./components/login";
import './App.css';
import Register from "./components/userRegistration";
import Home from "./components/home"; 
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<Home />} />
        {/* 他のルート */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
