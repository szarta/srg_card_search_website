import React, { useState } from "react";

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("");
  const [cardType, setCardType] = useState("");
  const [atkType, setAtkType] = useState("");
  const [playOrder, setPlayOrder] = useState("");

  // Competitor stats
  const [power, setPower] = useState("");
  const [agility, setAgility] = useState("");
  const [strike, setStrike] = useState("");
  const [submission, setSubmission] = useState("");
  const [grapple, setGrapple] = useState("");
  const [technique, setTechnique] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch({
      query,
      cardType,
      atkType,
      playOrder,
      power,
      agility,
      strike,
      submission,
      grapple,
      technique,
    });
  };

  const isMainDeck = cardType === "MainDeckCard";
  const isCompetitor =
    cardType === "SingleCompetitorCard" ||
    cardType === "TornadoCompetitorCard" ||
    cardType === "TrioCompetitorCard";

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-4 bg-neutral-900 p-4 rounded shadow-md"
    >
      <input
        type="text"
        placeholder="Search name or rules..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 bg-gray-900 text-white border border-gray-600 rounded px-3 py-2"
      />

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

      <select
        value={atkType}
        onChange={(e) => setAtkType(e.target.value)}
        disabled={!isMainDeck}
        className={`bg-gray-900 text-white border rounded px-3 py-2 ${
          !isMainDeck ? "opacity-50 cursor-not-allowed" : "border-gray-600"
        }`}
      >
        <option value="">Attack Type</option>
        <option value="Strike">Strike</option>
        <option value="Grapple">Grapple</option>
        <option value="Submission">Submission</option>
      </select>

      <select
        value={playOrder}
        onChange={(e) => setPlayOrder(e.target.value)}
        disabled={!isMainDeck}
        className={`bg-gray-900 text-white border rounded px-3 py-2 ${
          !isMainDeck ? "opacity-50 cursor-not-allowed" : "border-gray-600"
        }`}
      >
        <option value="">Play Order</option>
        <option value="Lead">Lead</option>
        <option value="Follow Up">Follow Up</option>
        <option value="Finish">Finish</option>
      </select>

      {isCompetitor && (
        <div className="flex flex-wrap gap-2">
          {[
            ["Power", power, setPower],
            ["Agility", agility, setAgility],
            ["Strike", strike, setStrike],
            ["Submission", submission, setSubmission],
            ["Grapple", grapple, setGrapple],
            ["Technique", technique, setTechnique],
          ].map(([label, value, setter]) => (
            <input
              key={label}
              type="number"
              placeholder={label}
              value={value}
              onChange={(e) => setter(e.target.value)}
              className="w-24 bg-gray-900 text-white border border-gray-600 rounded px-2 py-1"
            />
          ))}
        </div>
      )}

      <button
        type="submit"
        className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-600 transition"
      >
        Search
      </button>
    </form>
  );
}

