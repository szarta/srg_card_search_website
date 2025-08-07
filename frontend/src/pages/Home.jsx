import { useState } from "react";
import SearchBar from "../components/SearchBar";
import CardGrid from "../components/CardGrid"; // coming next

export default function Home() {
  const [results, setResults] = useState([]);

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">SRG Card Search</h1>
      <SearchBar onSearch={setResults} />
      <CardGrid cards={results} />
    </div>
  );
}

