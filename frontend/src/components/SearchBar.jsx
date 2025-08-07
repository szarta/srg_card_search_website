/** @jsxImportSource react */
import { useState } from "react";

const defaultFilters = { q: "", card_type: "", atk_type: "", play_order: "" };

export default function SearchBar({ onSearch }) {
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const fetchResults = (filters, page) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.append(k, v));
    params.append("limit", limit);
    params.append("offset", page * limit);

    fetch(`http://localhost:8000/cards?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setTotalCount(data.total_count || 0);
        onSearch(data.items, data.total_count);
      })
      .catch(console.error);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setPage(0);
    fetchResults(filters, 0);
  };

  const goPage = (delta) => {
    const newPage = page + delta;
    if (newPage < 0 || newPage * limit >= totalCount) return;
    setPage(newPage);
    fetchResults(filters, newPage);
  };

  const totalPages = Math.ceil(totalCount / limit);

  const handleChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div className="bg-srgGray rounded-lg p-4 shadow-md">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col md:flex-row md:items-end gap-4"
      >
        <input
          type="text"
          name="q"
          placeholder="Search name or rules..."
          value={filters.q}
          onChange={handleChange}
          className="bg-gray-800 text-gray-200 placeholder-gray-400 border border-gray-600 rounded flex-1 px-3 py-2 focus:ring focus:ring-srgPurple focus:outline-none"
        />

        <select
          name="card_type"
          value={filters.card_type}
          onChange={handleChange}
          className="bg-gray-800 text-gray-200 border border-gray-600 rounded px-3 py-2 focus:ring focus:ring-srgPurple focus:outline-none"
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
          name="atk_type"
          value={filters.atk_type}
          onChange={handleChange}
          className="bg-gray-800 text-gray-200 border border-gray-600 rounded px-3 py-2 focus:ring focus:ring-srgPurple focus:outline-none"
        >
          <option value="">All Attack Types</option>
          <option value="Strike">Strike</option>
          <option value="Grapple">Grapple</option>
          <option value="Submission">Submission</option>
        </select>

        <select
          name="play_order"
          value={filters.play_order}
          onChange={handleChange}
          className="bg-gray-800 text-gray-200 border border-gray-600 rounded px-3 py-2 focus:ring focus:ring-srgPurple focus:outline-none"
        >
          <option value="">All Play Orders</option>
          <option value="Lead">Lead</option>
          <option value="Follow Up">Follow Up</option>
          <option value="Finish">Finish</option>
        </select>

        <button
          type="submit"
          className="mt-2 md:mt-0 bg-srgPurple hover:bg-purple-600 text-white rounded px-6 py-2 font-semibold"
        >
          Search
        </button>
      </form>

      <div className="flex justify-between items-center mt-4 text-sm text-gray-400">
        <button
          onClick={() => goPage(-1)}
          disabled={page === 0}
          className={`rounded px-3 py-1 ${
            page === 0
              ? "bg-gray-700 cursor-not-allowed text-gray-600"
              : "bg-purple-700 hover:bg-purple-600 text-white"
          }`}
        >
          Previous
        </button>

        <span>
          Page {page + 1} of {totalPages || 1}
        </span>

        <button
          onClick={() => goPage(1)}
          disabled={(page + 1) * limit >= totalCount}
          className={`rounded px-3 py-1 ${
            (page + 1) * limit >= totalCount
              ? "bg-gray-700 cursor-not-allowed text-gray-600"
              : "bg-purple-700 hover:bg-purple-600 text-white"
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
}

