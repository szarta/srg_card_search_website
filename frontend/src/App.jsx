import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import CardDetail from "./pages/CardDetail";

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 text-gray-900">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/card/:uuid" element={<CardDetail />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
