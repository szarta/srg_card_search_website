import React, { useState, useEffect } from "react";

export default function SearchBar({ onSearch, defaultValues = {} }) {
  const [query, setQuery] = useState("");
  const [cardType, setCardType] = useState("");
  const [atkType, setAtkType] = useState("");
  const [playOrder, setPlayOrder] = useState("");
  const [deckCardNumber, setDeckCardNumber] = useState("");

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
    setQuery(defaultValues.query ?? "");
    setCardType(defaultValues.cardType ?? "");
    setAtkType(defaultValues.atkType ?? "");
    setPlayOrder(defaultValues.playOrder ?? "");
    setDeckCardNumber(defaultValues.deckCardNumber ?? "");
    setPower(defaultValues.power ?? "");
    setAgility(defaultValues.agility ?? "");
    setStrike(defaultValues.strike ?? "");
    setSubmission(defaultValues.submission ?? "");
    setGrapple(defaultValues.grapple ?? "");
    setTechnique(defaultValues.technique ?? "");
    setPageSize(parseInt(defaultValues.limit ?? 20, 10) || 20);
  }, [defaultValues]);

  const submitWith = (extra = {}) => {
    onSearch({
      query,
      cardType,
      atkType,
      playOrder,
      deckCardNumber,
      power,
      agility,
      strike,
      submission,
      grapple,
      technique,
      limit: pageSize,
      ...extra, // allow overrides
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitWith();
  };

  const handlePageSizeChange = (e) => {
    const newSize = parseInt(e.target.value, 10);
    if (!Number.isNaN(newSize) && newSize > 0) {
      setPageSize(newSize);
      // Trigger a new search immediately, reset to page 1 (handled in Home)
      submitWith({ limit: newSize });
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-4 bg-neutral-900 p-4 rounded shadow-md"
    >
      {/* Text search */}
      <input
        type="text"
        placeholder="Search name or rules..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 min-w-[220px] bg-gray-900 text-white border border-gray-700 rounded p-2"
      />

      {/* Card Type (full set) */}
      <select
        value={cardType}
        onChange={(e) => {
          const v = e.target.value;
          setCardType(v);
          // Clear fields that don't apply when switching card types
          if (v !== "MainDeckCard") {
            setDeckCardNumber("");
            setAtkType("");
            setPlayOrder("");
          }
          if (!["SingleCompetitorCard", "TornadoCompetitorCard", "TrioCompetitorCard"].includes(v)) {
            setPower("");
            setAgility("");
            setStrike("");
            setSubmission("");
            setGrapple("");
            setTechnique("");
          }
        }}
        className="bg-gray-900 text-white border border-gray-700 rounded p-2"
      >
        <option value="">All Types</option>
        <option value="MainDeckCard">Main Deck</option>
        <option value="SingleCompetitorCard">Single Competitor</option>
        <option value="TornadoCompetitorCard">Tornado Competitor</option>
        <option value="TrioCompetitorCard">Trio Competitor</option>
        <option value="EntranceCard">Entrance</option>
        <option value="SpectacleCard">Spectacle</option>
        <option value="CrowdMeterCard">Crowd Meter</option>
      </select>

      {/* Attack Type — only relevant to Main Deck */}
      <select
        value={atkType}
        onChange={(e) => setAtkType(e.target.value)}
        className={`bg-gray-900 text-white border border-gray-700 rounded p-2 ${
          cardType === "MainDeckCard" ? "" : "opacity-50"
        }`}
        disabled={cardType !== "MainDeckCard"}
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
        className={`bg-gray-900 text-white border border-gray-700 rounded p-2 ${
          cardType === "MainDeckCard" ? "" : "opacity-50"
        }`}
        disabled={cardType !== "MainDeckCard"}
      >
        <option value="">Any Play Order</option>
        <option value="Lead">Lead</option>
        <option value="Followup">Follow Up</option>
        <option value="Finish">Finish</option>
      </select>

      {/* Deck Card Number — only relevant to Main Deck */}
      <input
        type="number"
        inputMode="numeric"
        placeholder="Deck #"
        value={deckCardNumber}
        onChange={(e) => setDeckCardNumber(e.target.value)}
        disabled={cardType !== "MainDeckCard"}
        className={`w-24 bg-gray-900 text-white border border-gray-700 rounded p-2 ${
          cardType === "MainDeckCard" ? "" : "opacity-50"
        }`}
      />

      {/* Competitor stats — shown for competitor types */}
      {["SingleCompetitorCard", "TornadoCompetitorCard", "TrioCompetitorCard"].includes(cardType) && (
        <div className="flex gap-2 flex-wrap">
          {[
            ["power", power, setPower],
            ["agility", agility, setAgility],
            ["strike", strike, setStrike],
            ["submission", submission, setSubmission],
            ["grapple", grapple, setGrapple],
            ["technique", technique, setTechnique],
          ].map(([label, value, setter]) => (
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
      )}

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
    </form>
  );
}

