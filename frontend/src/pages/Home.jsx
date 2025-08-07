import { useState } from "react";
import SearchBar from "../components/SearchBar";
import CardGrid from "../components/CardGrid";

export default function Home() {
  const [results, setResults] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  const handleSearch = (items, total) => {
    setResults(items);
    setTotalCount(total);
  };

  return (
    <div>
      <SearchBar onSearch={handleSearch} />

      <p className="mt-4 text-sm text-gray-400">
        Showing {results.length} of {totalCount} matching cards
      </p>

      <CardGrid cards={results} />
    </div>
  );
}
