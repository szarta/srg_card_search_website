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
  });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const fetchCards = async (f, pageNum = 1) => {
    const params = new URLSearchParams();

    if (f.query) params.append("q", f.query);
    if (f.cardType) params.append("card_type", f.cardType);
    if (f.atkType) params.append("atk_type", f.atkType);
    if (f.playOrder) params.append("play_order", f.playOrder);
    params.append("limit", limit);
    params.append("offset", (pageNum - 1) * limit);

    const res = await fetch(`/cards?${params.toString()}`);
    const data = await res.json();
    setCards(data.items || []);
    setTotalCount(data.total || data.total_count || 0);
    setPage(pageNum);
  };

  useEffect(() => {
    // initial load
    fetchCards(filters, page);
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
          Showing {cards.length} of {totalCount} results
        </div>

        <div className="mt-6">
          <CardGrid cards={cards} />
        </div>

        <div className="flex justify-center items-center mt-6 space-x-4">
          <button
            onClick={handlePrev}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-800 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {page}
          </span>
          <button
            onClick={handleNext}
            disabled={page * limit >= totalCount}
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

