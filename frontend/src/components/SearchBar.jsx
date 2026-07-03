import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const COMPETITOR_TYPES = [
  "SingleCompetitorCard",
  "TornadoCompetitorCard",
  "TrioCompetitorCard",
];

const SELECT_CLASS = "bg-gray-900 text-white border border-gray-700 rounded p-2";

const STAT_NAMES = ["power", "agility", "strike", "submission", "grapple", "technique"];

// Comparison operators for stat filters. Value is the token sent to the backend;
// label is what the user sees.
const STAT_OPS = [
  { value: "eq", label: "=" },
  { value: "lt", label: "<" },
  { value: "gt", label: ">" },
  { value: "ne", label: "≠" },
];

// Known competitor divisions (checkbox multi-select).
const DIVISIONS = [
  "United States",
  "Intergalactic",
  "Hardcore",
  "Global",
  "World Championship",
  "Old School",
  "Underworld",
  "Super Lucha",
];

// Parse the comma-separated `division` value from the URL into an array.
function parseDivisions(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

// Normalize URL-provided defaults into concrete input values (with fallbacks).
function normalizeDefaults(d) {
  const statOps = {};
  STAT_NAMES.forEach((s) => {
    statOps[s] = d[`${s}_op`] || "eq";
  });
  return {
    query: d.query ?? "",
    cardType: d.cardType ?? "",
    atkType: d.atkType ?? "",
    playOrder: d.playOrder ?? "",
    deckCardNumberMin: d.deckCardNumberMin ?? "1",
    deckCardNumberMax: d.deckCardNumberMax ?? "27",
    power: d.power ?? "",
    agility: d.agility ?? "",
    strike: d.strike ?? "",
    submission: d.submission ?? "",
    grapple: d.grapple ?? "",
    technique: d.technique ?? "",
    statOps,
    pageSize: parseInt(d.limit ?? 20, 10) || 20,
    division: d.division ?? "",
  };
}

// Attack type / play order / deck-number filters — only meaningful for Main Deck cards.
function MainDeckFilters({
  isMainDeck,
  atkType,
  setAtkType,
  playOrder,
  setPlayOrder,
  deckCardNumberMin,
  setDeckCardNumberMin,
  deckCardNumberMax,
  setDeckCardNumberMax,
}) {
  const dim = isMainDeck ? "" : "opacity-50";
  return (
    <>
      {/* Attack Type — only relevant to Main Deck */}
      <select
        value={atkType}
        onChange={(e) => setAtkType(e.target.value)}
        className={`${SELECT_CLASS} ${dim}`}
        disabled={!isMainDeck}
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
        className={`${SELECT_CLASS} ${dim}`}
        disabled={!isMainDeck}
      >
        <option value="">Any Play Order</option>
        <option value="Lead">Lead</option>
        <option value="Followup">Follow Up</option>
        <option value="Finish">Finish</option>
      </select>

      {/* Deck Card Number Range — only relevant to Main Deck */}
      <div className={`flex items-center gap-2 ${dim}`}>
        <input
          type="number"
          inputMode="numeric"
          placeholder="Min"
          value={deckCardNumberMin}
          onChange={(e) => setDeckCardNumberMin(e.target.value)}
          disabled={!isMainDeck}
          min="1"
          max="30"
          className="w-20 bg-gray-900 text-white border border-gray-700 rounded p-2"
        />
        <span className="text-gray-400">-</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="Max"
          value={deckCardNumberMax}
          onChange={(e) => setDeckCardNumberMax(e.target.value)}
          disabled={!isMainDeck}
          min="1"
          max="30"
          className="w-20 bg-gray-900 text-white border border-gray-700 rounded p-2"
        />
      </div>
    </>
  );
}

// A single stat filter: comparison operator + numeric value.
function StatFilter({ name, value, setValue, op, setOp }) {
  return (
    <div className="flex items-center">
      <select
        aria-label={`${name} comparison`}
        value={op}
        onChange={(e) => setOp(name, e.target.value)}
        className="bg-gray-900 text-white border border-gray-700 rounded-l p-2 border-r-0"
      >
        {STAT_OPS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <input
        type="number"
        inputMode="numeric"
        placeholder={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 bg-gray-900 text-white border border-gray-700 rounded-r p-2"
      />
    </div>
  );
}

// Multi-select division filter rendered as a checkbox dropdown.
function DivisionFilter({ selected, setSelected }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close the dropdown when clicking outside of it.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toggle = (division) => {
    setSelected(
      selected.includes(division)
        ? selected.filter((d) => d !== division)
        : [...selected, division]
    );
  };

  const label =
    selected.length === 0
      ? "All Divisions"
      : selected.length === 1
        ? selected[0]
        : `${selected.length} divisions`;

  return (
    <div className="flex flex-col" ref={ref}>
      <label className="text-sm font-medium">Division</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="bg-gray-900 text-white border border-gray-700 rounded p-2 min-w-[160px] text-left"
        >
          {label} <span className="float-right text-gray-400">▾</span>
        </button>
        {open && (
          <div className="absolute z-20 mt-1 w-max min-w-full bg-gray-900 border border-gray-700 rounded shadow-lg p-2 max-h-64 overflow-y-auto">
            {DIVISIONS.map((division) => (
              <label
                key={division}
                className="flex items-center gap-2 px-1 py-1 hover:bg-gray-800 rounded cursor-pointer whitespace-nowrap"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(division)}
                  onChange={() => toggle(division)}
                />
                <span>{division}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Competitor stat inputs + division — only shown for competitor card types.
function CompetitorFilters({ isCompetitor, stats, statOps, setStatOp, divisions, setDivisions }) {
  if (!isCompetitor) return null;
  return (
    <>
      {/* Competitor stats */}
      <div className="flex gap-2 flex-wrap">
        {stats.map(([name, value, setter]) => (
          <StatFilter
            key={name}
            name={name}
            value={value}
            setValue={setter}
            op={statOps[name] ?? "eq"}
            setOp={setStatOp}
          />
        ))}
      </div>

      {/* Division: any Competitor card */}
      <DivisionFilter selected={divisions} setSelected={setDivisions} />
    </>
  );
}

export default function SearchBar({ onSearch, defaultValues = {} }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cardType, setCardType] = useState("");
  const [atkType, setAtkType] = useState("");
  const [playOrder, setPlayOrder] = useState("");
  const [deckCardNumberMin, setDeckCardNumberMin] = useState("1");
  const [deckCardNumberMax, setDeckCardNumberMax] = useState("27");
  const [divisions, setDivisions] = useState([]);

  // Competitor stats
  const [power, setPower] = useState("");
  const [agility, setAgility] = useState("");
  const [strike, setStrike] = useState("");
  const [submission, setSubmission] = useState("");
  const [grapple, setGrapple] = useState("");
  const [technique, setTechnique] = useState("");

  // Per-stat comparison operators (default "eq")
  const [statOps, setStatOps] = useState(() =>
    STAT_NAMES.reduce((acc, s) => ((acc[s] = "eq"), acc), {})
  );
  const setStatOp = (name, op) =>
    setStatOps((prev) => ({ ...prev, [name]: op }));

  // Page size (lives in URL via Home; controlled here for UI)
  const [pageSize, setPageSize] = useState(20);

  // Hydrate inputs when URL-provided defaults change
  useEffect(() => {
    const v = normalizeDefaults(defaultValues);
    setQuery(v.query);
    setCardType(v.cardType);
    setAtkType(v.atkType);
    setPlayOrder(v.playOrder);
    setDeckCardNumberMin(v.deckCardNumberMin);
    setDeckCardNumberMax(v.deckCardNumberMax);
    setPower(v.power);
    setAgility(v.agility);
    setStrike(v.strike);
    setSubmission(v.submission);
    setGrapple(v.grapple);
    setTechnique(v.technique);
    setStatOps(v.statOps);
    setPageSize(v.pageSize);
    setDivisions(parseDivisions(v.division));
  }, [defaultValues]);

  // Emit each stat op as `${stat}_op`, omitting the default "eq".
  const statOpParams = () => {
    const out = {};
    STAT_NAMES.forEach((s) => {
      if (statOps[s] && statOps[s] !== "eq") out[`${s}_op`] = statOps[s];
    });
    return out;
  };

  const submitWith = (extra = {}) => {
    onSearch({
      query,
      cardType,
      atkType,
      playOrder,
      deckCardNumberMin,
      deckCardNumberMax,
      power,
      agility,
      strike,
      submission,
      grapple,
      technique,
      ...statOpParams(),
      division: divisions.join(","),
      limit: pageSize,
      ...extra, // allow overrides
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitWith();
  };

  const handleCardTypeChange = (e) => {
    const v = e.target.value;
    setCardType(v);
    // Clear fields that don't apply when switching card types
    if (v !== "MainDeckCard") {
      setDeckCardNumberMin("1");
      setDeckCardNumberMax("27");
      setAtkType("");
      setPlayOrder("");
    }
    if (!COMPETITOR_TYPES.includes(v)) {
      setPower("");
      setAgility("");
      setStrike("");
      setSubmission("");
      setGrapple("");
      setTechnique("");
      setStatOps(STAT_NAMES.reduce((acc, s) => ((acc[s] = "eq"), acc), {}));
      setDivisions([]);
    }
  };

  const handleViewTable = () => {
    // Build URLSearchParams with current filters (use same keys Home/Table expect)
    const sp = new URLSearchParams();
    const add = (k, v) => {
      if (v !== undefined && v !== null && String(v).trim() !== "") sp.set(k, String(v));
    };
    add("query", query);
    add("cardType", cardType);
    add("atkType", atkType);
    add("playOrder", playOrder);
    add("deckCardNumberMin", deckCardNumberMin);
    add("deckCardNumberMax", deckCardNumberMax);
    add("power", power);
    add("agility", agility);
    add("strike", strike);
    add("submission", submission);
    add("grapple", grapple);
    add("technique", technique);
    Object.entries(statOpParams()).forEach(([k, v]) => add(k, v));
    add("division", divisions.join(","));
    // Keep current page size as a courtesy; TableView ignores pagination but might want to reflect "limit" in URL.
    add("limit", pageSize);
    navigate(`/table?${sp.toString()}`);
  };

  const handlePageSizeChange = (e) => {
    const newSize = parseInt(e.target.value, 10);
    if (!Number.isNaN(newSize) && newSize > 0) {
      setPageSize(newSize);
      // Trigger a new search immediately, reset to page 1 (handled in Home)
      submitWith({ limit: newSize });
    }
  };

  const isMainDeck = cardType === "MainDeckCard";
  const isCompetitor = COMPETITOR_TYPES.includes(cardType);
  const competitorStats = [
    ["power", power, setPower],
    ["agility", agility, setAgility],
    ["strike", strike, setStrike],
    ["submission", submission, setSubmission],
    ["grapple", grapple, setGrapple],
    ["technique", technique, setTechnique],
  ];

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-4 bg-neutral-900 p-4 rounded shadow-md"
    >
      {/* Text search */}
      <input
        type="text"
        placeholder="Search name, rules, or tags..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 min-w-[220px] bg-gray-900 text-white border border-gray-700 rounded p-2"
      />

      {/* Card Type (full set) */}
      <select value={cardType} onChange={handleCardTypeChange} className={SELECT_CLASS}>
        <option value="">All Types</option>
        <option value="MainDeckCard">Main Deck</option>
        <option value="SingleCompetitorCard">Single Competitor</option>
        <option value="TornadoCompetitorCard">Tornado Competitor</option>
        <option value="TrioCompetitorCard">Trio Competitor</option>
        <option value="EntranceCard">Entrance</option>
        <option value="SpectacleCard">Spectacle</option>
        <option value="CrowdMeterCard">Crowd Meter</option>
      </select>

      <MainDeckFilters
        isMainDeck={isMainDeck}
        atkType={atkType}
        setAtkType={setAtkType}
        playOrder={playOrder}
        setPlayOrder={setPlayOrder}
        deckCardNumberMin={deckCardNumberMin}
        setDeckCardNumberMin={setDeckCardNumberMin}
        deckCardNumberMax={deckCardNumberMax}
        setDeckCardNumberMax={setDeckCardNumberMax}
      />

      <CompetitorFilters
        isCompetitor={isCompetitor}
        stats={competitorStats}
        statOps={statOps}
        setStatOp={setStatOp}
        divisions={divisions}
        setDivisions={setDivisions}
      />

      {/* Page size selector (inside Search UI) */}
      <div className="flex items-center gap-2">
        <label htmlFor="pageSize" className="text-sm text-gray-300">
          Page size:
        </label>
        <select
          id="pageSize"
          value={pageSize}
          onChange={handlePageSizeChange}
          className="bg-gray-900 text-white border border-gray-700 rounded p-2"
        >
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>

      <button
        type="submit"
        className="bg-purple-700 text-white px-4 py-2 rounded hover:bg-purple-600 transition"
      >
        Search
      </button>

      <button
        type="button"
        onClick={handleViewTable}
        className="hidden md:inline-block bg-indigo-700 text-white px-4 py-2 rounded hover:bg-indigo-600 transition"
        title="Open full results as a table (no pagination)"
      >
        View Table
      </button>
    </form>
  );
}
