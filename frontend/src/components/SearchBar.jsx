import { useState } from "react";

const defaultFilters = {
  q: "",
  card_type: "",
  atk_type: "",
  play_order: "",
};

export default function SearchBar({ onSearch }) {
  const [filters, setFilters] = useState(defaultFilters);

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value) query.append(key, value);
    }

    fetch(`http://localhost:8000/cards?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        onSearch(data.items || []);
      })
      .catch(console.error);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-4 rounded shadow">
      <input
        type="text"
        name="q"
        placeholder="Search name or rules..."
        value={filters.q}
        onChange={handleChange}
        className="w-full p-2 border rounded"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <select name="card_type" value={filters.card_type} onChange={handleChange} className="p-2 border rounded">
          <option value="">All Card Types</option>
          <option value="MainDeckCard">Main Deck</option>
          <option value="SingleCompetitorCard">Single Competitor</option>
          <option value="TornadoCompetitorCard">Tornado Competitor</option>
          <option value="TrioCompetitorCard">Trio Competitor</option>
          <option value="EntranceCard">Entrance</option>
          <option value="SpectacleCard">Spectacle</option>
          <option value="CrowdMeterCard">Crowd Meter</option>
        </select>

        <select name="atk_type" value={filters.atk_type} onChange={handleChange} className="p-2 border rounded">
          <option value="">All Attack Types</option>
          <option value="Strike">Strike</option>
          <option value="Grapple">Grapple</option>
          <option value="Submission">Submission</option>
        </select>

        <select name="play_order" value={filters.play_order} onChange={handleChange} className="p-2 border rounded">
          <option value="">All Play Orders</option>
          <option value="Lead">Lead</option>
          <option value="Follow Up">Follow Up</option>
          <option value="Finish">Finish</option>
        </select>
      </div>

      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
        Search
      </button>
    </form>
  );
}
