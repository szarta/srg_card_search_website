// src/App.jsx
import { useState, useEffect } from "react";
import SearchBar from "./components/SearchBar";
import CardGrid from "./components/CardGrid";

export default function App() {
  const [cards, setCards] = useState([]);

  const handleSearch = async (params) => {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`http://localhost:8000/cards?${query}`);
    const data = await response.json();
    setCards(data.items); // assuming your FastAPI response includes `items`
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-center mt-4">SRG Supershow Card Search</h1>
      <SearchBar onSearch={handleSearch} />
      <CardGrid cards={cards} />
    </div>
  );
}
