import { BrowserRouter, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import Home from "./pages/Home";
import Centres from "./pages/Centres";
import Exercises from "./pages/Exercises";
import Tracker from "./pages/Tracker";
import Marketplace from "./pages/Marketplace";
import Assistant from "./pages/Assistant";
import Login from "./pages/Login";
import SavedCentres from "./pages/SavedCentres";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/centres" element={<Centres />} />
        <Route path="/exercises" element={<Exercises />} />
        <Route path="/tracker" element={<Tracker />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/saved-centres" element={<SavedCentres />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/login" element={<Login />} />
      </Routes>

      <Footer />
    </BrowserRouter>
  );
}

export default App;
