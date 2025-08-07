import React, { useState } from "react";

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("");
  const [cardType, setCardType] = useState("");
  const [atkType, setAtkType] = useState("");
  const [playOrder, setPlayOrder] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("SUBMIT", { query, cardType, atkType, playOrder });
    onSearch({ query, cardType, atkType, playOrder });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-4 bg-neutral-900 p-4 rounded-md shadow">
      <input
        type="text"
        placeholder="Search name or rules..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="bg-gray-900 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-purple-500"
      />

      <select
        value={cardType}
        onChange={(e) => setCardType(e.target.value)}
        className="bg-gray-900 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-purple-500"
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
        className="bg-gray-900 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-purple-500"
      >
        <option value="">All Attack Types</option>
        <option value="Strike">Strike</option>
        <option value="Grapple">Grapple</option>
        <option value="Submission">Submission</option>
      </select>

      <select
        value={playOrder}
        onChange={(e) => setPlayOrder(e.target.value)}
        className="bg-gray-900 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:ring focus:ring-purple-500"
      >
        <option value="">All Play Orders</option>
        <option value="Lead">Lead</option>
        <option value="Followup">Follow Up</option>
        <option value="Finish">Finish</option>
      </select>

      <button
        type="submit"
        className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-600 focus:outline-none focus:ring focus:ring-purple-400 transition"
      >
        Search
      </button>
    </form>
  );
}

