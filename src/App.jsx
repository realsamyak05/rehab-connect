import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Centres from "./pages/Centres";
import Exercises from "./pages/Exercises";
import Tracker from "./pages/Tracker";
import Marketplace from "./pages/Marketplace";
import Assistant from "./pages/Assistant";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/centres" element={<Centres />} />
        <Route path="/exercises" element={<Exercises />} />
        <Route path="/tracker" element={<Tracker />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/assistant" element={<Assistant />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
