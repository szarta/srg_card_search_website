// src/pages/CreateList.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DeckGridFromNames from "../components/DeckGridFromNames.jsx";   // <-- swap in the grid

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

// Parse one card name per non-empty, non-comment line. Supports quoted names; ignores '#'.
function parseNames(text) {
  const lines = text.split(/\r?\n/);
  const names = [];
  for (let raw of lines) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^\s*"([^"]+)"\s*$/);
    if (m) line = m[1].trim();
    if (line) names.push(line);
  }
  return names;
}

export default function CreateList() {
  const query = useQuery();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]); // unknown names, etc.
  const textareaRef = useRef(null);

  // If a curated list is provided (?list=my-list), load it from public/lists/<slug>.txt or .json
  useEffect(() => {
    const slug = query.get("list");
    if (!slug) return;

    async function loadSaved() {
      try {
        const txtRes = await fetch(`/lists/${slug}.txt`);
        if (txtRes.ok) {
          const t = await txtRes.text();
          setText(t);
          return;
        }
      } catch {}
      try {
        const jsonRes = await fetch(`/lists/${slug}.json`);
        if (jsonRes.ok) {
          const j = await jsonRes.json();
          const t = Array.isArray(j?.names) ? j.names.join("\n") : "";
          setText(t);
          return;
        }
      } catch {}
    }
    loadSaved();
  }, [query]);

  const handleBuild = async () => {
    const names = parseNames(text);
    if (names.length === 0) {
      setRows([]);
      setErrors([]);
      return;
    }
    setLoading(true);
    setErrors([]);

    try {
      const res = await fetch("/cards/by-names", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(data.rows || []);
      setErrors(data.unmatched || []);
    } catch (e) {
      console.error(e);
      setErrors(["Failed to build list. Check server logs."]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setText("");
    setRows([]);
    setErrors([]);
    textareaRef.current?.focus();
    if (query.get("list")) navigate("/create-list", { replace: true });
  };

  const exportFileName = query.get("list") ? `${query.get("list")}.csv` : "custom-list.csv";

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-3">Create List</h1>
      <p className="text-sm opacity-80 mb-2">
        Paste one card name per line. Lines starting with <code>#</code> are ignored.
      </p>

      <div className="grid gap-3 mb-4">
        <textarea
          ref={textareaRef}
          className="w-full min-h-[200px] rounded-xl border p-3 font-mono
                     bg-white text-black border-slate-300 placeholder-slate-500
                     focus:outline-none focus:ring"
          placeholder={`Example:\n"3/4 Wrist Lock"\n4 Starts the Party\nAlana Antoinnette`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white"
            onClick={handleBuild}
            disabled={loading}
          >
            {loading ? "Building…" : "Build Grid"}
          </button>
          <button
            className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-black"
            onClick={handleClear}
          >
            Clear
          </button>
        </div>
      </div>

      {errors?.length > 0 && (
        <div className="mb-4 text-sm">
          <span className="font-semibold">Unmatched names:</span> {errors.join(", ")}
        </div>
      )}

      {/* Grid preview with the SAME CSV/HTML export buttons & format */}
      <DeckGridFromNames
        rowsOverride={rows}
        pageSize={40}
        title="Preview"
        enableExport
        exportFileName={exportFileName}
      />
    </div>
  );
}

