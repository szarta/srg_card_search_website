import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import CardDetail from "./pages/CardDetail";

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col font-sans text-gray-100">

        {/* Header */}
        <header className="bg-srgGray px-6 py-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h1 className="text-3xl font-bold text-srgPurple">SRG Card Search</h1>
          </div>
        </header>

        {/* Main */}
        <main className="flex-grow px-4 py-6 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/card/:uuid" element={<CardDetail />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-srgGray text-gray-400 py-10 mt-10">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
            <h3 className="text-white font-bold mb-2">Cards</h3>
            <ul className="space-y-1">
                <li><a className="hover:text-srgPurple" href="/">Search</a></li>
                <li><a className="hover:text-srgPurple" href="#">Syntax Guide</a></li>
                <li><a className="hover:text-srgPurple" href="#">All Sets</a></li>
                <li><a className="hover:text-srgPurple" href="#">Random Card</a></li>
            </ul>
            </div>
            <div>
            <h3 className="text-white font-bold mb-2">SRG</h3>
            <ul className="space-y-1">
                <li><a className="hover:text-srgPurple" href="https://supershowthegame.com" target="_blank" rel="noreferrer">Official Site</a></li>
                <li><a className="hover:text-srgPurple" href="#">FAQs</a></li>
                <li><a className="hover:text-srgPurple" href="#">Community</a></li>
            </ul>
            </div>
            <div>
            <h3 className="text-white font-bold mb-2">Developer</h3>
            <ul className="space-y-1">
                <li><a className="hover:text-srgPurple" href="https://github.com/szarta/srg_card_search_website" target="_blank" rel="noreferrer">GitHub</a></li>
                <li><a className="hover:text-srgPurple" href="#">API</a></li>
            </ul>
            </div>
            <div>
            <h3 className="text-white font-bold mb-2">Legal</h3>
            <ul className="space-y-1">
                <li><a className="hover:text-srgPurple" href="#">Terms</a></li>
                <li><a className="hover:text-srgPurple" href="#">Privacy</a></li>
                <li><a className="hover:text-srgPurple" href="#">Contact</a></li>
            </ul>
            </div>
        </div>
        <div className="text-center mt-6 text-xs text-gray-500">
            SRG Card Search unofficial database. All SRG Supershow card properties © SRG Universe.
        </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
