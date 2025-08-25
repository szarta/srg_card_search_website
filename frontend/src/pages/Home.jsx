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
  "division",     // NEW
  "gender",       // NEW
];

const DEFAULT_LIMIT = 20;

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams();

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
    division: "",   // NEW
    gender: "",     // NEW
  });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const readFromURL = () => {
    const obj = Object.fromEntries(searchParams.entries());
    // start from empty values so missing params reset correctly
    const empty = FILTER_KEYS.reduce((acc, k) => ((acc[k] = ""), acc), {});
    const f = { ...empty };
    FILTER_KEYS.forEach((k) => {
      if (obj[k] !== undefined) f[k] = obj[k];
    });
    const p = parseInt(obj.page || "1", 10);
    const l = parseInt(obj.limit || String(DEFAULT_LIMIT), 10);
    return { f, p: Number.isNaN(p) ? 1 : p, l: Number.isNaN(l) ? DEFAULT_LIMIT : l };
  };

  const writeToURL = (f, p, l) => {
    const sp = new URLSearchParams();
    const fObj = f ?? filters;

    FILTER_KEYS.forEach((k) => {
      const v = fObj[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        sp.set(k, String(v));
      }
    });

    const pageVal = p ?? page;
    const limitVal = l ?? limit;
    if (pageVal && pageVal !== 1) sp.set("page", String(pageVal));
    if (limitVal && limitVal !== DEFAULT_LIMIT) sp.set("limit", String(limitVal));
    setSearchParams(sp, { replace: false });
  };

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

      ["power", "agility", "strike", "submission", "grapple", "technique"].forEach((k) => {
        const v = f?.[k];
        if (v !== "" && v !== null && v !== undefined) {
          const n = parseInt(v, 10);
          if (!Number.isNaN(n)) params.append(k, String(n));
        }
      });

      // NEW: forward division & gender to backend
      if (f.division) params.append("division", f.division);
      if (f.gender)   params.append("gender", f.gender); // Male | Female | Ambiguous

      params.append("limit", String(lNum));
      params.append("offset", String((pNum - 1) * lNum));

      const res = await fetch(`/cards?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setCards(Array.isArray(data?.items) ? data.items : []);
      setTotalCount(Number.isFinite(data?.total_count) ? data.total_count : 0);
      setPage(pNum);
      setLimit(lNum);
      setFilters(f);
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setLoading(false);
    }
  };

  // Hydrate from URL & refetch on Back/Forward
  useEffect(() => {
    const { f, p, l } = readFromURL();
    setFilters(f);
    setPage(p);
    setLimit(l);
    fetchCards(f, p, l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Accept limit coming from SearchBar
  const handleSearch = (nextFilters) => {
    const newLimit = parseInt(nextFilters?.limit ?? limit, 10);
    writeToURL(nextFilters, 1, Number.isNaN(newLimit) ? limit : newLimit);
  };

  const handlePrev = () => {
    if (page > 1) writeToURL(filters, page - 1, limit);
  };

  const handleNext = () => {
    if (page * limit < totalCount) writeToURL(filters, page + 1, limit);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div className="min-h-screen flex flex-col text-white">
      <div className="w-full px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-6">SRG Card Search</h1>

        {/* pass limit via defaultValues so the SearchBar selector initializes correctly */}
        <SearchBar onSearch={handleSearch} defaultValues={{ ...filters, limit }} />

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
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={handlePrev}
            disabled={loading || page === 1}
            className="px-4 py-2 bg-gray-800 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
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

