import React, { useState } from "react";

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
  // Sync from URL-provided defaults (e.g., when returning via back button)
  React.useEffect(() => {
    if (!defaultValues) return;
    if (defaultValues.query !== undefined) setQuery(defaultValues.query || "");
    if (defaultValues.cardType !== undefined) setCardType(defaultValues.cardType || "");
    if (defaultValues.atkType !== undefined) setAtkType(defaultValues.atkType || "");
    if (defaultValues.playOrder !== undefined) setPlayOrder(defaultValues.playOrder || "");
    if (defaultValues.deckCardNumber !== undefined) setDeckCardNumber(defaultValues.deckCardNumber || "");
    if (defaultValues.power !== undefined) setPower(defaultValues.power || "");
    if (defaultValues.agility !== undefined) setAgility(defaultValues.agility || "");
    if (defaultValues.strike !== undefined) setStrike(defaultValues.strike || "");
    if (defaultValues.submission !== undefined) setSubmission(defaultValues.submission || "");
    if (defaultValues.grapple !== undefined) setGrapple(defaultValues.grapple || "");
    if (defaultValues.technique !== undefined) setTechnique(defaultValues.technique || "");
  }, [defaultValues]);


  const isMainDeck = cardType === "MainDeckCard";
  const isCompetitor =
    cardType === "SingleCompetitorCard" ||
    cardType === "TornadoCompetitorCard" ||
    cardType === "TrioCompetitorCard";

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch({
      query,
      cardType,
      atkType,
      playOrder,
      deckCardNumber, // Home.jsx will only include when MainDeck
      power,
      agility,
      strike,
      submission,
      grapple,
      technique,      // Home.jsx already guards to send only valid numbers
    });
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
        className="flex-1 min-w-[220px] bg-gray-900 text-white border border-gray-600 rounded px-3 py-2"
      />

      {/* Card type */}
      <select
        value={cardType}
        onChange={(e) => setCardType(e.target.value)}
        className="bg-gray-900 text-white border border-gray-600 rounded px-3 py-2"
      >
        <option value="">All Card Types</option>
        <option value="MainDeckCard">Main Deck</option>
        <option value="SingleCompetitorCard">Single Competitor</option>
        <option value="TornadoCompetitorCard">Tornado Competitor</option>
        <option value="TrioCompetitorCard">Trio Competitor</option>
        <option value="EntranceCard">Entrance</option>
        <option value="SpectacleCard">Spectacle</option>
        <option value="CrowdMeterCard">Crowd Meter</option>
      </select>

      {/* Attack type (Main Deck only) */}
      <select
        value={atkType}
        onChange={(e) => setAtkType(e.target.value)}
        disabled={!isMainDeck}
        className={`bg-gray-900 text-white border rounded px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          isMainDeck ? "border-gray-600" : "border-gray-700"
        }`}
      >
        <option value="">Attack Type</option>
        <option value="Strike">Strike</option>
        <option value="Grapple">Grapple</option>
        <option value="Submission">Submission</option>
      </select>

      {/* Play order (Main Deck only) */}
      <select
        value={playOrder}
        onChange={(e) => setPlayOrder(e.target.value)}
        disabled={!isMainDeck}
        className={`bg-gray-900 text-white border rounded px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          isMainDeck ? "border-gray-600" : "border-gray-700"
        }`}
      >
        <option value="">Play Order</option>
        <option value="Lead">Lead</option>
        <option value="Followup">Follow Up</option>
        <option value="Finish">Finish</option>
      </select>

      {/* Card Number — always visible, disabled unless Main Deck */}
      <input
        type="number"
        min="1"
        placeholder="Card Number"
        value={deckCardNumber}
        onChange={(e) => setDeckCardNumber(e.target.value)}
        disabled={!isMainDeck}
        className={`w-36 bg-gray-900 text-white border rounded px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed ${
          isMainDeck ? "border-gray-600" : "border-gray-700"
        }`}
      />

      {/* Competitor stats — always visible, disabled unless competitor type */}
      <div className="flex flex-wrap gap-2">
        {[
          ["Power", power, setPower],
          ["Technique", technique, setTechnique],
          ["Agility", agility, setAgility],
          ["Strike", strike, setStrike],
          ["Submission", submission, setSubmission],
          ["Grapple", grapple, setGrapple],
        ].map(([label, value, setter]) => (
          <input
            key={label}
            type="number"
            placeholder={label}
            value={value}
            onChange={(e) => setter(e.target.value)}
            disabled={!isCompetitor}
            className={`w-24 bg-gray-900 text-white border rounded px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed ${
              isCompetitor ? "border-gray-600" : "border-gray-700"
            }`}
          />
        ))}
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

