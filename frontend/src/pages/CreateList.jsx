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

// Fetch a shared list and hydrate its cards. Returns { notFound } for a missing
// id, otherwise { name, rows, names, missing }.
async function fetchSharedListData(sharedId) {
  const res = await fetch(`/api/shared-lists/${sharedId}`);
  if (!res.ok) {
    if (res.status === 404) return { notFound: true };
    throw new Error(`HTTP ${res.status}`);
  }

  const sharedList = await res.json();

  // Convert UUIDs back to card data
  const cardRes = await fetch("/cards/by-uuids", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uuids: sharedList.card_uuids }),
  });
  if (!cardRes.ok) throw new Error(`HTTP ${cardRes.status}`);
  const cardData = await cardRes.json();

  return {
    name: sharedList.name || "",
    rows: cardData.rows,
    names: cardData.rows.map((row) => row.name),
    missing: cardData.missing || [],
  };
}

// Load curated list text from .txt (preferred) or .json; null if neither exists.
async function fetchCuratedListText(slug) {
  try {
    const txtRes = await fetch(`/lists/${slug}.txt`);
    if (txtRes.ok) return await txtRes.text();
  } catch { /* ignore and try json */ }

  try {
    const jsonRes = await fetch(`/lists/${slug}.json`);
    if (jsonRes.ok) {
      const j = await jsonRes.json();
      return Array.isArray(j?.names) ? j.names.join("\n") : "";
    }
  } catch { /* ignore */ }

  return null;
}

// Resolve card names to rows via the batch endpoint.
async function buildListRows(names) {
  const res = await fetch("/cards/by-names", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ names }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { rows: data.rows || [], unmatched: data.unmatched || [] };
}

// Extract shareable UUIDs from rows; returns { error } or { cardUuids, warning }.
function prepareShareUuids(rows) {
  // try both db_uuid and uuid fields
  const cardUuids = rows.map((row) => row.db_uuid || row.uuid).filter(Boolean);

  if (cardUuids.length === 0) {
    return { error: "No valid card UUIDs found. Please rebuild the list." };
  }

  const warning =
    cardUuids.length !== rows.length
      ? `Warning: Only ${cardUuids.length} of ${rows.length} cards have valid UUIDs.`
      : null;
  return { cardUuids, warning };
}

async function createSharedList(listName, cardUuids) {
  const res = await fetch("/api/shared-lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: listName || "Untitled List",
      card_uuids: cardUuids,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("API Error:", res.status, errorText);
    throw new Error(`HTTP ${res.status}: ${errorText}`);
  }
  return res.json();
}

function missingWarning(missing) {
  if (missing.length === 0) return [];
  return [`Warning: ${missing.length} cards could not be found in database`];
}

function computeExportFileName(query) {
  const list = query.get("list");
  if (list) return `${list}.csv`;
  const shared = query.get("shared");
  if (shared) return `shared-list-${shared}.csv`;
  return "custom-list.csv";
}

function hasListParam(query) {
  return Boolean(query.get("list") || query.get("shared"));
}

function ErrorBanner({ errors }) {
  if (!errors?.length) return null;
  const label =
    errors.length === 1 && errors[0].includes("Unmatched") ? "Unmatched names:" : "Errors:";
  return (
    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
      <span className="font-semibold text-red-800">{label}</span>
      <span className="text-red-700 ml-1">{errors.join(", ")}</span>
    </div>
  );
}

export default function CreateList() {
  const query = useQuery();
  const navigate = useNavigate();
  const location = useLocation(); // Add this
  const [text, setText] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
  const [listName, setListName] = useState("");
  const [loadedFromShare, setLoadedFromShare] = useState(false);
  const textareaRef = useRef(null);

  // Load shared list from database
  const loadSharedList = async (sharedId) => {
    try {
      setLoading(true);
      const result = await fetchSharedListData(sharedId);
      if (result.notFound) {
        setErrors(["Shared list not found."]);
        return;
      }

      setListName(result.name);
      setText(result.names.join("\n"));
      setRows(result.rows);
      setLoadedFromShare(true);
      setErrors(missingWarning(result.missing));
    } catch (e) {
      console.error(e);
      setErrors(["Failed to load shared list."]);
    } finally {
      setLoading(false);
    }
  };

  // Load curated list from files (existing functionality)
  const loadCuratedList = async (slug) => {
    const t = await fetchCuratedListText(slug);
    if (t !== null) setText(t);
  };

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
      const { rows: builtRows, unmatched } = await buildListRows(names);
      setRows(builtRows);
      setErrors(unmatched);
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
      const { cardUuids, error, warning } = prepareShareUuids(rows);
      if (error) {
        setErrors([error]);
        return;
      }
      if (warning) setErrors([warning]);

      const result = await createSharedList(listName, cardUuids);
      const fullUrl = `${window.location.origin}/create-list?shared=${result.id}`;
      setShareUrl(fullUrl);

      // Copy to clipboard
      await navigator.clipboard.writeText(fullUrl);
    } catch (e) {
      console.error("Share error:", e);
      setErrors([`Failed to create shareable link: ${e.message}`]);
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
    if (hasListParam(query)) {
      navigate("/create-list", { replace: true });
    }
  };

  const exportFileName = computeExportFileName(query);

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

      <ErrorBanner errors={errors} />

      {/* Add key prop to force remount when location changes */}
      <DeckGridFromNames
        key={location.search} // Force remount when URL params change
        rowsOverride={rows}
        pageSize={40}
        title="Preview"
        enableExport
        exportFileName={exportFileName}
        onShare={handleShare}
        sharing={sharing}
        shareUrl={shareUrl}
      />
    </div>
  );
}
