import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import CardGrid from "../components/CardGrid";
import Footer from "../components/Footer";

const FILTER_KEYS = [
  "query",
  "cardType",
  "atkType",
  "playOrder",
  "deckCardNumber",
  "power",
  "agility",
  "strike",
  "submission",
  "grapple",
  "technique",
];

export default function Home() {
  // ----- URL state -----
  const [searchParams, setSearchParams] = useSearchParams();

  // ----- UI state -----
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
  const [limit, setLimit] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // ----- URL helpers -----
  const readFromURL = () => {
    const obj = Object.fromEntries(searchParams.entries());
    const f = { ...filters };
    FILTER_KEYS.forEach((k) => {
      if (obj[k] !== undefined) f[k] = obj[k];
    });
    const p = parseInt(obj.page || "1", 10);
    const l = parseInt(obj.limit || "50", 10);
    return { f, p: Number.isNaN(p) ? 1 : p, l: Number.isNaN(l) ? 50 : l };
  };

  const writeToURL = (f, p, l) => {
    const sp = new URLSearchParams();
    FILTER_KEYS.forEach((k) => {
      const v = f[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        sp.set(k, String(v));
      }
    });
    if (p && p !== 1) sp.set("page", String(p));
    if (l && l !== 50) sp.set("limit", String(l));
    setSearchParams(sp, { replace: false });
  };

  // ----- Data fetcher -----
  const fetchCards = async (f, pNum = 1, lNum = limit) => {
    setLoading(true);
    setCards([]);
    setTotalCount(0);

    try {
      const params = new URLSearchParams();

      if (f.query) params.append("q", f.query);
      if (f.cardType) params.append("card_type", f.cardType);
      if (f.atkType) params.append("atk_type", f.atkType);
      if (f.playOrder) params.append("play_order", f.playOrder);

      if (f.cardType === "MainDeckCard" && f.deckCardNumber !== "") {
        const n = parseInt(f.deckCardNumber, 10);
        if (!Number.isNaN(n)) params.append("deck_card_number", String(n));
      }

      // competitor stat filters
      ["power", "agility", "strike", "submission", "grapple", "technique"].forEach((k) => {
        const v = f?.[k];
        if (v !== "" && v !== null && v !== undefined) {
          const n = parseInt(v, 10);
          if (!Number.isNaN(n)) params.append(k, String(n));
        }
      });

      params.append("limit", String(lNum));
      params.append("offset", String((pNum - 1) * lNum));

      const url = `/api/cards?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setCards(data?.results || []);
      setTotalCount(data?.total_count || 0);
      setPage(pNum);
      setLimit(lNum);
      setFilters(f);
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setLoading(false);
    }
  };

  // ----- On mount & on URL change, hydrate and fetch -----
  useEffect(() => {
    const { f, p, l } = readFromURL();
    setFilters(f);
    setPage(p);
    setLimit(l);
    fetchCards(f, p, l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ----- Handlers -----
  const handleSearch = (nextFilters) => {
    // New search resets to page 1 and writes to URL (effect will refetch)
    writeToURL(nextFilters, 1, limit);
  };

  const handlePrev = () => {
    if (page > 1) writeToURL(filters, page - 1, limit);
  };

  const handleNext = () => {
    if (page * limit < totalCount) writeToURL(filters, page + 1, limit);
  };

  return (
    <div className="min-h-screen flex flex-col text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-6">SRG Card Search</h1>

        <SearchBar onSearch={handleSearch} defaultValues={filters} />

        {/* Results */}
        <div className="mt-6">
          {loading ? (
            <p className="text-center text-gray-400">Loading…</p>
          ) : cards.length === 0 ? (
            <p className="text-center text-gray-400">No cards found.</p>
          ) : (
            <CardGrid cards={cards} />
          )}
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center mt-6 space-x-4">
          <button
            onClick={handlePrev}
            disabled={loading || page === 1}
            className="px-4 py-2 bg-gray-800 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.max(1, Math.ceil(totalCount / limit))}
          </span>
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
