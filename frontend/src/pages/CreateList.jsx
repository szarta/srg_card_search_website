// src/pages/CreateList.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import DeckGridFromNames from "../components/DeckGridFromNames.jsx";

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
  const [errors, setErrors] = useState([]);
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const [listName, setListName] = useState("");
  const [loadedFromShare, setLoadedFromShare] = useState(false);
  const textareaRef = useRef(null);

  // Load curated lists or shared lists
  useEffect(() => {
    const slug = query.get("list");
    const sharedId = query.get("shared");

    if (sharedId) {
      loadSharedList(sharedId);
    } else if (slug) {
      loadCuratedList(slug);
    }
  }, [query]);

  // Load shared list from database
  const loadSharedList = async (sharedId) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/shared-lists/${sharedId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setErrors(["Shared list not found."]);
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
        return;
      }

      const sharedList = await res.json();
      setListName(sharedList.name || "");

      // Convert UUIDs back to card data
      const cardRes = await fetch("/cards/by-uuids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuids: sharedList.card_uuids }),
      });

      if (!cardRes.ok) throw new Error(`HTTP ${cardRes.status}`);
      const cardData = await cardRes.json();

      // Set the card names as text and rows for display
      const names = cardData.rows.map(row => row.name);
      setText(names.join("\n"));
      setRows(cardData.rows);
      setLoadedFromShare(true);

      // Show any missing cards if they exist
      if (cardData.missing && cardData.missing.length > 0) {
        setErrors([`Warning: ${cardData.missing.length} cards could not be found in database`]);
      } else {
        setErrors([]);
      }

    } catch (e) {
      console.error(e);
      setErrors(["Failed to load shared list."]);
    } finally {
      setLoading(false);
    }
  };

  // Load curated list from files (existing functionality)
  const loadCuratedList = async (slug) => {
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
  };

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

  const handleShare = async () => {
    if (rows.length === 0) {
      setErrors(["Please build a list first before sharing."]);
      return;
    }

    setSharing(true);
    try {
      const cardUuids = rows.map(row => row.db_uuid); // Fixed: use db_uuid instead of uuid
      const res = await fetch("/api/shared-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: listName || "Untitled List",
          card_uuids: cardUuids,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      const fullUrl = `${window.location.origin}/create-list?shared=${result.id}`;
      setShareUrl(fullUrl);

      // Copy to clipboard
      await navigator.clipboard.writeText(fullUrl);

    } catch (e) {
      console.error(e);
      setErrors(["Failed to create shareable link."]);
    } finally {
      setSharing(false);
    }
  };

  const handleClear = () => {
    setText("");
    setRows([]);
    setErrors([]);
    setShareUrl("");
    setListName("");
    setLoadedFromShare(false);
    textareaRef.current?.focus();
    if (query.get("list") || query.get("shared")) {
      navigate("/create-list", { replace: true });
    }
  };

  const exportFileName = query.get("list")
    ? `${query.get("list")}.csv`
    : query.get("shared")
    ? `shared-list-${query.get("shared")}.csv`
    : "custom-list.csv";

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-3">
        Create List
        {loadedFromShare && listName && (
          <span className="text-lg font-normal text-gray-600 ml-2">- {listName}</span>
        )}
      </h1>
      <p className="text-sm opacity-80 mb-4">
        Paste one card name per line. Lines starting with <code>#</code> are ignored.
        {loadedFromShare && (
          <span className="block text-blue-600 mt-1">
            ✓ Loaded from shared link
          </span>
        )}
      </p>

      <div className="grid gap-3 mb-4">
        {/* List name input */}
        <input
          type="text"
          className="w-full rounded-xl border p-3 bg-white text-black border-slate-300
                     placeholder-slate-500 focus:outline-none focus:ring"
          placeholder="List name (optional)"
          value={listName}
          onChange={(e) => setListName(e.target.value)}
        />

        <textarea
          ref={textareaRef}
          className="w-full min-h-[200px] rounded-xl border p-3 font-mono
                     bg-white text-black border-slate-300 placeholder-slate-500
                     focus:outline-none focus:ring"
          placeholder={`Example:\n"3/4 Wrist Lock"\n4 Starts the Party\nAlana Antoinnette`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <div className="flex gap-2 flex-wrap">
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
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <span className="font-semibold text-red-800">
            {errors.length === 1 && errors[0].includes("Unmatched")
              ? "Unmatched names:"
              : "Errors:"
            }
          </span>
          <span className="text-red-700 ml-1">{errors.join(", ")}</span>
        </div>
      )}

      {/* Pass share-related props to DeckGridFromNames */}
      <DeckGridFromNames
        rowsOverride={rows}
        pageSize={40}
        title="Preview"
        enableExport
        exportFileName={exportFileName}
        onShare={handleShare}
        sharing={sharing}
        shareUrl={shareUrl}
        listName={listName}
      />
    </div>
  );
}
