import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const COMPETITOR_TYPES = [
  "SingleCompetitorCard",
  "TornadoCompetitorCard",
  "TrioCompetitorCard",
];

const SELECT_CLASS = "bg-gray-900 text-white border border-gray-700 rounded p-2";

// Normalize URL-provided defaults into concrete input values (with fallbacks).
function normalizeDefaults(d) {
  return {
    query: d.query ?? "",
    cardType: d.cardType ?? "",
    atkType: d.atkType ?? "",
    playOrder: d.playOrder ?? "",
    deckCardNumberMin: d.deckCardNumberMin ?? "1",
    deckCardNumberMax: d.deckCardNumberMax ?? "27",
    power: d.power ?? "",
    agility: d.agility ?? "",
    strike: d.strike ?? "",
    submission: d.submission ?? "",
    grapple: d.grapple ?? "",
    technique: d.technique ?? "",
    pageSize: parseInt(d.limit ?? 20, 10) || 20,
    division: d.division ?? "",
  };
}

// Attack type / play order / deck-number filters — only meaningful for Main Deck cards.
function MainDeckFilters({
  isMainDeck,
  atkType,
  setAtkType,
  playOrder,
  setPlayOrder,
  deckCardNumberMin,
  setDeckCardNumberMin,
  deckCardNumberMax,
  setDeckCardNumberMax,
}) {
  const dim = isMainDeck ? "" : "opacity-50";
  return (
    <>
      {/* Attack Type — only relevant to Main Deck */}
      <select
        value={atkType}
        onChange={(e) => setAtkType(e.target.value)}
        className={`${SELECT_CLASS} ${dim}`}
        disabled={!isMainDeck}
      >
        <option value="">All Attack Types</option>
        <option value="Strike">Strike</option>
        <option value="Grapple">Grapple</option>
        <option value="Submission">Submission</option>
      </select>

      {/* Play Order — only relevant to Main Deck */}
      <select
        value={playOrder}
        onChange={(e) => setPlayOrder(e.target.value)}
        className={`${SELECT_CLASS} ${dim}`}
        disabled={!isMainDeck}
      >
        <option value="">Any Play Order</option>
        <option value="Lead">Lead</option>
        <option value="Followup">Follow Up</option>
        <option value="Finish">Finish</option>
      </select>

      {/* Deck Card Number Range — only relevant to Main Deck */}
      <div className={`flex items-center gap-2 ${dim}`}>
        <input
          type="number"
          inputMode="numeric"
          placeholder="Min"
          value={deckCardNumberMin}
          onChange={(e) => setDeckCardNumberMin(e.target.value)}
          disabled={!isMainDeck}
          min="1"
          max="30"
          className="w-20 bg-gray-900 text-white border border-gray-700 rounded p-2"
        />
        <span className="text-gray-400">-</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="Max"
          value={deckCardNumberMax}
          onChange={(e) => setDeckCardNumberMax(e.target.value)}
          disabled={!isMainDeck}
          min="1"
          max="30"
          className="w-20 bg-gray-900 text-white border border-gray-700 rounded p-2"
        />
      </div>
    </>
  );
}

// Competitor stat inputs + division — only shown for competitor card types.
function CompetitorFilters({ isCompetitor, stats, division, setDivision }) {
  if (!isCompetitor) return null;
  return (
    <>
      {/* Competitor stats */}
      <div className="flex gap-2 flex-wrap">
        {stats.map(([label, value, setter]) => (
          <input
            key={label}
            type="number"
            inputMode="numeric"
            placeholder={label}
            value={value}
            onChange={(e) => setter(e.target.value)}
            className="w-24 bg-gray-900 text-white border border-gray-700 rounded p-2"
          />
        ))}
      </div>

      {/* Division: any Competitor card */}
      <div className="flex flex-col">
        <label className="text-sm font-medium">Division</label>
        <input
          className="bg-gray-900 text-white border border-gray-700 rounded p-2"
          value={division}
          onChange={(e) => setDivision(e.target.value)}
          placeholder="e.g., United States"
        />
      </div>
    </>
  );
}

export default function SearchBar({ onSearch, defaultValues = {} }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cardType, setCardType] = useState("");
  const [atkType, setAtkType] = useState("");
  const [playOrder, setPlayOrder] = useState("");
  const [deckCardNumberMin, setDeckCardNumberMin] = useState("1");
  const [deckCardNumberMax, setDeckCardNumberMax] = useState("27");
  const [division, setDivision] = useState("");

  // Competitor stats
  const [power, setPower] = useState("");
  const [agility, setAgility] = useState("");
  const [strike, setStrike] = useState("");
  const [submission, setSubmission] = useState("");
  const [grapple, setGrapple] = useState("");
  const [technique, setTechnique] = useState("");

  // Page size (lives in URL via Home; controlled here for UI)
  const [pageSize, setPageSize] = useState(20);

  // Hydrate inputs when URL-provided defaults change
  useEffect(() => {
    const v = normalizeDefaults(defaultValues);
    setQuery(v.query);
    setCardType(v.cardType);
    setAtkType(v.atkType);
    setPlayOrder(v.playOrder);
    setDeckCardNumberMin(v.deckCardNumberMin);
    setDeckCardNumberMax(v.deckCardNumberMax);
    setPower(v.power);
    setAgility(v.agility);
    setStrike(v.strike);
    setSubmission(v.submission);
    setGrapple(v.grapple);
    setTechnique(v.technique);
    setPageSize(v.pageSize);
    setDivision(v.division);
  }, [defaultValues]);

  const submitWith = (extra = {}) => {
    onSearch({
      query,
      cardType,
      atkType,
      playOrder,
      deckCardNumberMin,
      deckCardNumberMax,
      power,
      agility,
      strike,
      submission,
      grapple,
      technique,
      division,
      limit: pageSize,
      ...extra, // allow overrides
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitWith();
  };

  const handleCardTypeChange = (e) => {
    const v = e.target.value;
    setCardType(v);
    // Clear fields that don't apply when switching card types
    if (v !== "MainDeckCard") {
      setDeckCardNumberMin("1");
      setDeckCardNumberMax("27");
      setAtkType("");
      setPlayOrder("");
    }
    if (!COMPETITOR_TYPES.includes(v)) {
      setPower("");
      setAgility("");
      setStrike("");
      setSubmission("");
      setGrapple("");
      setTechnique("");
      setDivision("");
    }
  };

  const handleViewTable = () => {
    // Build URLSearchParams with current filters (use same keys Home/Table expect)
    const sp = new URLSearchParams();
    const add = (k, v) => {
      if (v !== undefined && v !== null && String(v).trim() !== "") sp.set(k, String(v));
    };
    add("query", query);
    add("cardType", cardType);
    add("atkType", atkType);
    add("playOrder", playOrder);
    add("deckCardNumberMin", deckCardNumberMin);
    add("deckCardNumberMax", deckCardNumberMax);
    add("power", power);
    add("agility", agility);
    add("strike", strike);
    add("submission", submission);
    add("grapple", grapple);
    add("technique", technique);
    add("division", division);
    // Keep current page size as a courtesy; TableView ignores pagination but might want to reflect "limit" in URL.
    add("limit", pageSize);
    navigate(`/table?${sp.toString()}`);
  };

  const handlePageSizeChange = (e) => {
    const newSize = parseInt(e.target.value, 10);
    if (!Number.isNaN(newSize) && newSize > 0) {
      setPageSize(newSize);
      // Trigger a new search immediately, reset to page 1 (handled in Home)
      submitWith({ limit: newSize });
    }
  };

  const isMainDeck = cardType === "MainDeckCard";
  const isCompetitor = COMPETITOR_TYPES.includes(cardType);
  const competitorStats = [
    ["power", power, setPower],
    ["agility", agility, setAgility],
    ["strike", strike, setStrike],
    ["submission", submission, setSubmission],
    ["grapple", grapple, setGrapple],
    ["technique", technique, setTechnique],
  ];

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-4 bg-neutral-900 p-4 rounded shadow-md"
    >
      {/* Text search */}
      <input
        type="text"
        placeholder="Search name, rules, or tags..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 min-w-[220px] bg-gray-900 text-white border border-gray-700 rounded p-2"
      />

      {/* Card Type (full set) */}
      <select value={cardType} onChange={handleCardTypeChange} className={SELECT_CLASS}>
        <option value="">All Types</option>
        <option value="MainDeckCard">Main Deck</option>
        <option value="SingleCompetitorCard">Single Competitor</option>
        <option value="TornadoCompetitorCard">Tornado Competitor</option>
        <option value="TrioCompetitorCard">Trio Competitor</option>
        <option value="EntranceCard">Entrance</option>
        <option value="SpectacleCard">Spectacle</option>
        <option value="CrowdMeterCard">Crowd Meter</option>
      </select>

      <MainDeckFilters
        isMainDeck={isMainDeck}
        atkType={atkType}
        setAtkType={setAtkType}
        playOrder={playOrder}
        setPlayOrder={setPlayOrder}
        deckCardNumberMin={deckCardNumberMin}
        setDeckCardNumberMin={setDeckCardNumberMin}
        deckCardNumberMax={deckCardNumberMax}
        setDeckCardNumberMax={setDeckCardNumberMax}
      />

      <CompetitorFilters
        isCompetitor={isCompetitor}
        stats={competitorStats}
        division={division}
        setDivision={setDivision}
      />

      {/* Page size selector (inside Search UI) */}
      <div className="flex items-center gap-2">
        <label htmlFor="pageSize" className="text-sm text-gray-300">
          Page size:
        </label>
        <select
          id="pageSize"
          value={pageSize}
          onChange={handlePageSizeChange}
          className="bg-gray-900 text-white border border-gray-700 rounded p-2"
        >
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      <button
        type="submit"
        className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-600 transition"
      >
        Search
      </button>

      <button
        type="button"
        onClick={handleViewTable}
        className="hidden md:inline-block bg-indigo-700 text-white px-4 py-2 rounded hover:bg-indigo-600 transition"
        title="Open full results as a table (no pagination)"
      >
        View Table
      </button>
    </form>
  );
}
