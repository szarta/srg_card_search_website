import { useState } from "react";

const cardTypes = [
  "MainDeckCard",
  "SingleCompetitorCard",
  "TornadoCompetitorCard",
  "TrioCompetitorCard",
  "EntranceCard",
  "SpectacleCard",
  "CrowdMeterCard",
];

const attackTypes = ["Strike", "Grapple", "Submission"];
const playOrders = ["Lead", "Follow Up", "Finish"];

export default function SearchBar({ onSearch }) {
  const [searchText, setSearchText] = useState("");
  const [filters, setFilters] = useState({
    card_type: "",
    atk_type: "",
    play_order: "",
  });

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const params = {};
    if (searchText) params.q = searchText;
    if (filters.card_type) params.card_type = filters.card_type;
    if (filters.atk_type) params.atk_type = filters.atk_type;
    if (filters.play_order) params.play_order = filters.play_order;

    onSearch(params);
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <input
        type="text"
        placeholder="Search card name or text..."
        className="w-full p-2 border rounded"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <select name="card_type" onChange={handleChange} value={filters.card_type} className="p-2 border rounded">
          <option value="">All Card Types</option>
          {cardTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select name="atk_type" onChange={handleChange} value={filters.atk_type} className="p-2 border rounded">
          <option value="">All Attack Types</option>
          {attackTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select name="play_order" onChange={handleChange} value={filters.play_order} className="p-2 border rounded">
          <option value="">All Play Orders</option>
          {playOrders.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
      >
        Search
      </button>
    </form>
  );
}
