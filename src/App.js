import './App.css';
import Home from "./components/home"; 
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "./components/Auth";
import ReviewPost from "./components/reviewPost";
import EditProfile from "./components/editProfile";
import PrivateRoute from "./components/PrivateRoute"; // 追加

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route
          path="/home"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/reviewPost"
          element={
            <PrivateRoute>
              <ReviewPost />
            </PrivateRoute>
          }
        />
        <Route
          path="/editProfile"
          element={
            <PrivateRoute>
              <EditProfile />
            </PrivateRoute>
          }
        />
        {/* 他のルート */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
