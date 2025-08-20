import React, { useState, useEffect } from "react";

export default function SearchBar({ onSearch, defaultValues = {} }) {
  const [query, setQuery] = useState("");
  const [cardType, setCardType] = useState("");
  const [atkType, setAtkType] = useState("");
  const [playOrder, setPlayOrder] = useState("");
  const [deckCardNumber, setDeckCardNumber] = useState("");

  // Competitor stats
  const [power, setPower] = useState("");
  const [agility, setAgility] = useState("");
  const [strike, setStrike] = useState("");
  const [submission, setSubmission] = useState("");
  const [grapple, setGrapple] = useState("");
  const [technique, setTechnique] = useState("");

  // Hydrate inputs when the URL-provided defaults change
  useEffect(() => {
    setQuery(defaultValues.query ?? "");
    setCardType(defaultValues.cardType ?? "");
    setAtkType(defaultValues.atkType ?? "");
    setPlayOrder(defaultValues.playOrder ?? "");
    setDeckCardNumber(defaultValues.deckCardNumber ?? "");
    setPower(defaultValues.power ?? "");
    setAgility(defaultValues.agility ?? "");
    setStrike(defaultValues.strike ?? "");
    setSubmission(defaultValues.submission ?? "");
    setGrapple(defaultValues.grapple ?? "");
    setTechnique(defaultValues.technique ?? "");
  }, [defaultValues]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch({
      query,
      cardType,
      atkType,
      playOrder,
      deckCardNumber,
      power,
      agility,
      strike,
      submission,
      grapple,
      technique,      // Home.jsx already guards to send only valid numbers
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-4 bg-neutral-900 p-4 rounded shadow-md"
    >
      {/* Text search */}
      <input
        type="text"
        placeholder="Search name or rules..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 min-w-[220px] bg-gray-900 text-white border border-gray-700 rounded p-2"
      />

      {/* Card Type */}
      <select
        value={cardType}
        onChange={(e) => {
          setCardType(e.target.value);
          // Clear fields that don't apply when switching card types
          setDeckCardNumber("");
          setPower("");
          setAgility("");
          setStrike("");
          setSubmission("");
          setGrapple("");
          setTechnique("");
        }}
        className="bg-gray-900 text-white border border-gray-700 rounded p-2"
      >
        <option value="">All Types</option>
        <option value="MainDeckCard">Main Deck</option>
        <option value="SingleCompetitorCard">Single Competitor</option>
        <option value="TornadoCompetitorCard">Tornado Competitor</option>
        <option value="TrioCompetitorCard">Trio Competitor</option>
      </select>

      {/* Attack Type — only relevant to Main Deck */}
      <select
        value={atkType}
        onChange={(e) => setAtkType(e.target.value)}
        className={`bg-gray-900 text-white border border-gray-700 rounded p-2 ${
          cardType === "MainDeckCard" ? "" : "opacity-50"
        }`}
        disabled={cardType !== "MainDeckCard"}
      >
        <option value="">All Attack Types</option>
        <option value="Strike">Strike</option>
        <option value="Grapple">Grapple</option>
        <option value="Submission">Submission</option>
      </select>

      {/* Play Order — only relevant to Main Deck */}
      <select
        value={playOrder}
        onChange={(e) => setPlayOrder(e.target.value)}
        className={`bg-gray-900 text-white border border-gray-700 rounded p-2 ${
          cardType === "MainDeckCard" ? "" : "opacity-50"
        }`}
        disabled={cardType !== "MainDeckCard"}
      >
        <option value="">Any Play Order</option>
        <option value="Lead">Lead</option>
        <option value="Followup">Follow Up</option>
        <option value="Finish">Finish</option>
      </select>

      {/* Deck Card Number — only relevant to Main Deck */}
      <input
        type="number"
        inputMode="numeric"
        placeholder="Deck #"
        value={deckCardNumber}
        onChange={(e) => setDeckCardNumber(e.target.value)}
        disabled={cardType !== "MainDeckCard"}
        className={`w-24 bg-gray-900 text-white border border-gray-700 rounded p-2 ${
          cardType === "MainDeckCard" ? "" : "opacity-50"
        }`}
      />

      {/* Competitor stats — shown for competitor types */}
      {["SingleCompetitorCard", "TornadoCompetitorCard", "TrioCompetitorCard"].includes(cardType) && (
        <div className="flex gap-2 flex-wrap">
          {[
            ["power", power, setPower],
            ["agility", agility, setAgility],
            ["strike", strike, setStrike],
            ["submission", submission, setSubmission],
            ["grapple", grapple, setGrapple],
            ["technique", technique, setTechnique],
          ].map(([label, value, setter]) => (
            <input
              key={label}
              type="number"
              inputMode="numeric"
              placeholder={label}
              value={value}
              onChange={(e) => setter(e.target.value)}
              className="w-24 bg-gray-900 text-white border border-gray-700 rounded p-2"
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
