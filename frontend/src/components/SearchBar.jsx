// src/components/SearchBar.jsx
import React, { useState } from "react";

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("");
  const [cardType, setCardType] = useState("");
  const [atkType, setAtkType] = useState("");
  const [playOrder, setPlayOrder] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch({ query, cardType, atkType, playOrder });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 mb-6">
      <input
        type="text"
        placeholder="Search name or rules..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white w-64"
      />
      <select
        value={cardType}
        onChange={(e) => setCardType(e.target.value)}
        className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
      >
        <option value="">All Card Types</option>
        <option value="MainDeckCard">Main Deck</option>
        <option value="FinishCard">Finish</option>
        <option value="LeadCard">Lead</option>
        <option value="FollowUpCard">Follow Up</option>
      </select>
      <select
        value={atkType}
        onChange={(e) => setAtkType(e.target.value)}
        className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
      >
        <option value="">All Attack Types</option>
        <option value="Strike">Strike</option>
        <option value="Grapple">Grapple</option>
        <option value="Submission">Submission</option>
      </select>
      <select
        value={playOrder}
        onChange={(e) => setPlayOrder(e.target.value)}
        className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
      >
        <option value="">All Play Orders</option>
        <option value="1">Turn 1</option>
        <option value="2">Turn 2+</option>
      </select>
      <button
        type="submit"
        className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-700"
      >
        Search
      </button>
    </form>
  );
}

