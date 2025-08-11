import React, { useState, useEffect } from "react";
import SearchBar from "../components/SearchBar";
import CardGrid from "../components/CardGrid";
import Footer from "../components/Footer";

export default function Home() {
  const [cards, setCards] = useState([]);
  const [filters, setFilters] = useState({
    query: "",
    cardType: "",
    atkType: "",
    playOrder: "",
    deckCardNumber: "",
    power: "",
    agility: "",
    strike: "",
    submission: "",
    grapple: "",
    technique: "",
  });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 20;

  const fetchCards = async (f, pageNum = 1) => {
    setLoading(true);
    setCards([]);
    setTotalCount(0);

    const params = new URLSearchParams();

    if (f.query) params.append("q", f.query);
    if (f.cardType) params.append("card_type", f.cardType);
    if (f.atkType) params.append("atk_type", f.atkType);
    if (f.playOrder) params.append("play_order", f.playOrder);

    // Main Deck: deck_card_number
    if (f.cardType === "MainDeckCard" && f.deckCardNumber !== "") {
      const n = parseInt(f.deckCardNumber, 10);
      if (!Number.isNaN(n)) params.append("deck_card_number", String(n));
    }

    // competitor stat filters (backend expects Optional[int])
    ["power", "agility", "strike", "submission", "grapple", "technique"].forEach(
      (k) => {
        const v = f?.[k];
        if (v !== "" && v !== null && v !== undefined) {
          const n = parseInt(v, 10);
          if (!Number.isNaN(n)) params.append(k, String(n));
        }
      }
    );

    params.append("limit", limit);
    params.append("offset", (pageNum - 1) * limit);

    const url = `/cards?${params.toString()}`;
    console.log("GET", url);

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCards(Array.isArray(data.items) ? data.items : []);
      setTotalCount(data.total_count ?? data.total ?? 0);
      setPage(pageNum);
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards(filters, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (newFilters) => {
    setFilters(newFilters);
    fetchCards(newFilters, 1);
  };

  const handlePrev = () => {
    if (page > 1) fetchCards(filters, page - 1);
  };

  const handleNext = () => {
    if (page * limit < totalCount) fetchCards(filters, page + 1);
  };

  return (
    <div className="min-h-screen flex flex-col text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-6">SRG Card Search</h1>

        <SearchBar onSearch={handleSearch} />

        <div className="mt-4 text-sm text-center text-gray-300">
          {loading ? "Loading…" : `Showing ${cards.length} of ${totalCount} results`}
        </div>

        <div className="mt-6">
          {loading ? (
            <p className="text-center text-gray-400">Loading…</p>
          ) : cards.length === 0 ? (
            <p className="text-center text-gray-400">No cards found.</p>
          ) : (
            <CardGrid cards={cards} />
          )}
        </div>

        <div className="flex justify-center items-center mt-6 space-x-4">
          <button
            onClick={handlePrev}
            disabled={loading || page === 1}
            className="px-4 py-2 bg-gray-800 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {page}</span>
          <button
            onClick={handleNext}
            disabled={loading || page * limit >= totalCount}
            className="px-4 py-2 bg-gray-800 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>

        <Footer />
      </div>
    </div>
  );
}

