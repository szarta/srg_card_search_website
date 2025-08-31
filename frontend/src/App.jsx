import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import CardDetail from "./pages/CardDetail";
import DeckList    from "./pages/DeckList";
import ArticlePage from "./pages/ArticlePage";
import TableView from "./pages/TableView";

// NEW: Create List page (free-form list → table)
import CreateList from "./pages/CreateList";

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col font-sans text-gray-100">

        {/* Main */}
        <main className="flex-grow w-full px-4 py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/card/:idOrSlug" element={<CardDetail />} />
            <Route path="/table" element={<TableView />} />
            <Route path="/decks" element={<DeckList />} />
            <Route path="/decks/:slug" element={<ArticlePage />} />

            {/* NEW: Create List route */}
            <Route path="/create-list" element={<CreateList />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-srgGray text-gray-400 py-10 mt-10">
          <div className="w-full px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <h3 className="text-white font-bold mb-2">Cards</h3>
              <ul className="space-y-1">
                <li><a className="hover:text-srgPurple" href="/">Search</a></li>
                <li><a className="hover:text-srgPurple" href="/create-list">Create List</a></li> {/* NEW link */}
                <li><a className="hover:text-srgPurple" href="#">Random Card</a></li>
                <li><a className="hover:text-srgPurple" href="/decks">Decks</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-bold mb-2">SRG</h3>
              <ul className="space-y-1">
                <li><a className="hover:text-srgPurple" href="https://supershowthegame.com" target="_blank" rel="noreferrer">Official Site</a></li>
                <li><a className="hover:text-srgPurple" href="https://www.srgpc.net/">SRGPC Card Database</a></li>
                <li><a className="hover:text-srgPurple" href="https://www.facebook.com/groups/824706107919586/">Supershow Facebook Group</a></li>
                <li><a className="hover:text-srgPurple" href="https://www.facebook.com/groups/1022514771216225">Card Trading Group</a></li>
                <li><a className="hover:text-srgPurple" href="https://docs.google.com/spreadsheets/d/1xW0nvIHkUgeV8N9_p7nDjHCqDzw7OpLo3ggf4M7kPvA/htmlview">Project Spider (Competitor Division Spreadsheet)</a></li>
                <li><a className="hover:text-srgPurple" href="https://supershowaftermarket.myshopify.com/">Supershow Aftermarket</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-bold mb-2">Developer</h3>
              <ul className="space-y-1">
                <li><a className="hover:text-srgPurple" href="https://github.com/szarta/srg_card_search_website" target="_blank" rel="noreferrer">GitHub</a></li>
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
