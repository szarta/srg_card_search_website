import { useState, useEffect } from "react";

const defaultFilters = {
  q: "",
  card_type: "",
  atk_type: "",
  play_order: "",
};

export default function SearchBar({ onSearch }) {
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const fetchResults = (filters, page) => {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
      if (value) query.append(key, value);
    }

    query.append("limit", limit);
    query.append("offset", page * limit);

    fetch(`http://localhost:8000/cards?${query.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setTotalCount(data.total_count || 0);
        onSearch(data.items || []);
      })
      .catch(console.error);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    fetchResults(filters, 0);
  };

  const handlePageChange = (direction) => {
    const newPage = page + direction;
    if (newPage < 0) return;
    setPage(newPage);
    fetchResults(filters, newPage);
  };

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-4 bg-white p-4 rounded shadow">
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="q"
          placeholder="Search name or rules..."
          value={filters.q}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
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

        <button type="submit" className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Search
        </button>
      </form>

      <div className="flex justify-between items-center pt-2 text-sm">
        <button
          onClick={() => handlePageChange(-1)}
          disabled={page === 0}
          className={`px-3 py-1 rounded ${
            page === 0 ? "bg-gray-300 text-gray-600 cursor-not-allowed" : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
        >
          Previous
        </button>

        <span>
          Page {page + 1} of {totalPages || 1}
        </span>

        <button
          onClick={() => handlePageChange(1)}
          disabled={(page + 1) * limit >= totalCount}
          className={`px-3 py-1 rounded ${
            (page + 1) * limit >= totalCount
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
