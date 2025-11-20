import { RouterProvider, createBrowserRouter, Link, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Home from "./pages/Home";
import CardDetail from "./pages/CardDetail";
import DeckList from "./pages/DeckList";
import ArticlePage from "./pages/ArticlePage";
import TableView from "./pages/TableView";

import SubmitMissingCard from "./pages/SubmitMissingCard";
import SubmitMissingImage from "./pages/SubmitMissingImage";
import CreateList from "./pages/CreateList";
import PrivacyPolicy from "./pages/PrivacyPolicy";

// Component to scroll to top on route change
function ScrollToTop() {
  const { pathname, key } = useLocation();

  useEffect(() => {
    console.log('Route changed to:', pathname, 'key:', key);
    window.scrollTo(0, 0);
  }, [pathname, key]);

  return null;
}

// Debug component to log route changes
function RouteLogger() {
  const location = useLocation();

  useEffect(() => {
    console.log('Location changed:', location);
  }, [location]);

  return null;
}

// Layout component that wraps all routes
function Layout() {
  return (
    <>
      <ScrollToTop />
      <RouteLogger />
      <div className="min-h-screen flex flex-col font-sans text-gray-100">
        {/* Main */}
        <main className="flex-grow w-full px-4 py-6">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="bg-srgGray text-gray-400 py-10 mt-10">
          <div className="w-full px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <h3 className="text-white font-bold mb-2">Cards</h3>
              <ul className="space-y-1">
                <li><a className="hover:text-srgPurple" href="/">Search</a></li>
                <li><a className="hover:text-srgPurple" href="/create-list">Create List</a></li>
                <li><a className="hover:text-srgPurple" href="/submit-missing-card">Submit Missing Card</a></li>
                <li><a className="hover:text-srgPurple" href="/submit-missing-image">Submit Missing Image</a></li>
                <li><a className="hover:text-srgPurple" href="/decks">Decks</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-bold mb-2">SRG</h3>
              <ul className="space-y-1">
                <li><a className="hover:text-srgPurple" href="https://supershowthegame.com" target="_blank" rel="noreferrer">Official Site</a></li>
                <li><a className="hover:text-srgPurple" href="https://www.srgpc.net/">SRGPC Card Database</a></li>
                <li><a className="hover:text-srgPurple" href="https://supershow-scoring.app">Supershow Scoring (where Competitor rankings are)</a></li>
                <li><a className="hover:text-srgPurple" href="https://www.facebook.com/groups/824706107919586/">Supershow Facebook Group</a></li>
                <li><a className="hover:text-srgPurple" href="https://www.facebook.com/groups/1022514771216225">Card Trading Group</a></li>
                <li><a className="hover:text-srgPurple" href="https://supershowaftermarket.myshopify.com/">Supershow Aftermarket</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-bold mb-2">Legal</h3>
              <ul className="space-y-1">
                <li><a className="hover:text-srgPurple" href="/privacy">Privacy Policy</a></li>
                <li><a className="hover:text-srgPurple" href="https://github.com/szarta/srg_card_search_website" target="_blank" rel="noreferrer">GitHub</a></li>
              </ul>
            </div>
          </div>
          <div className="text-center mt-6 text-xs text-gray-500">
            SRG Card Search unofficial database. All SRG Supershow card properties © SRG Universe.
          </div>
        </footer>
      </div>
    </>
  );
}

// Create the router using React Router v7 API
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/card/:idOrSlug", element: <CardDetail /> },
      { path: "/table", element: <TableView /> },
      { path: "/decks", element: <DeckList /> },
      { path: "/decks/:slug", element: <ArticlePage /> },
      { path: "/create-list", element: <CreateList /> },
      { path: "/submit-missing-card", element: <SubmitMissingCard /> },
      { path: "/submit-missing-image", element: <SubmitMissingImage /> },
      { path: "/privacy", element: <PrivacyPolicy /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
