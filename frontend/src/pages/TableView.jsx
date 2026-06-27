import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  appendInt,
  computeColumns,
  toCSV,
  toHTMLNoCSS,
  triggerDownload,
} from "../lib/cardExport";

const SAFE_CHUNK = 100; // stay within backend validators

// Translate UI filters into the backend's /cards query string.
function buildQuery(filters, limit, offset) {
  const q = new URLSearchParams();

  if (filters.query) q.append("q", filters.query);
  if (filters.cardType) q.append("card_type", filters.cardType);
  if (filters.atkType) q.append("atk_type", filters.atkType);
  if (filters.division) q.append("division", filters.division);

  if (filters.playOrder) {
    const po = filters.playOrder === "Follow Up" ? "Followup" : filters.playOrder;
    q.append("play_order", po);
  }

  if (filters.cardType === "MainDeckCard") {
    appendInt(q, "deck_card_number_min", filters.deckCardNumberMin);
    appendInt(q, "deck_card_number_max", filters.deckCardNumberMax);
  }

  ["power", "agility", "strike", "submission", "grapple", "technique"].forEach((k) => {
    appendInt(q, k, filters[k]);
  });

  q.append("limit", String(limit));
  q.append("offset", String(offset));
  return q;
}

function renderCell(r, c) {
  let v = r?.[c];
  if (v === null || v === undefined) v = "";

  // Name links to card detail
  if (c === "name" && r?.db_uuid) {
    return (
      <td key={c} className="px-3 py-2 border-b border-gray-800 break-all">
        <Link className="text-srgPurple hover:underline" to={`/card/${r.db_uuid}`}>
          {String(v)}
        </Link>
      </td>
    );
  }

  // Make srg_url clickable
  if (c === "srg_url" && typeof v === "string" && v) {
    return (
      <td key={c} className="px-3 py-2 border-b border-gray-800 break-all">
        <a href={v} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
          {v}
        </a>
      </td>
    );
  }

  if (Array.isArray(v) || typeof v === "object") {
    try {
      v = JSON.stringify(v);
    } catch {
      v = String(v);
    }
  }

  return (
    <td key={c} className="px-3 py-2 border-b border-gray-800 break-all">
      {String(v)}
    </td>
  );
}

// Read UI filters out of the URL search params.
function parseFilters(searchParams) {
  const obj = Object.fromEntries(searchParams.entries());
  return {
    query: obj.query || "",
    cardType: obj.cardType || "",
    atkType: obj.atkType || "",
    playOrder: obj.playOrder || "",
    deckCardNumberMin: obj.deckCardNumberMin || "1",
    deckCardNumberMax: obj.deckCardNumberMax || "27",
    division: obj.division || "",
    power: obj.power || "",
    agility: obj.agility || "",
    strike: obj.strike || "",
    submission: obj.submission || "",
    grapple: obj.grapple || "",
    technique: obj.technique || "",
  };
}

// Fetch every matching row in SAFE_CHUNK-sized pages. Returns null if cancelled.
async function fetchAllRows(filters, isCancelled) {
  const limit = SAFE_CHUNK;

  // first call to get total_count
  const firstResp = await fetch(`/cards?${buildQuery(filters, limit, 0).toString()}`);
  if (!firstResp.ok) throw new Error(`HTTP ${firstResp.status}`);
  const firstData = await firstResp.json();
  if (isCancelled()) return null;

  const total = Number.isFinite(firstData?.total_count) ? firstData.total_count : 0;
  const acc = Array.isArray(firstData?.items) ? firstData.items.slice() : [];

  // remaining chunks
  const requests = [];
  for (let offset = acc.length; offset < total; offset += limit) {
    const q = buildQuery(filters, limit, offset);
    requests.push(
      fetch(`/cards?${q.toString()}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
    );
  }

  const chunks = requests.length ? await Promise.all(requests) : [];
  if (isCancelled()) return null;

  for (const d of chunks) {
    if (Array.isArray(d?.items)) acc.push(...d.items);
  }
  return { rows: acc, total };
}

// Scrollable results table with sticky header.
function ResultsTable({ rows, columns, totalCount, hasOverride }) {
  const summary = hasOverride
    ? `Showing ${rows.length.toLocaleString()} items`
    : `Showing ${rows.length.toLocaleString()} of ${totalCount.toLocaleString()} matches`;

  return (
    <>
      <p className="text-gray-300 mb-2">{summary}</p>

      <div className="overflow-x-auto overflow-y-auto max-h-[75vh] border border-gray-700 rounded">
        <table className="w-full">
          <thead className="bg-gray-900 sticky top-0 z-10 shadow">
            <tr>
              {columns.map((c) => (
                <th
                  key={c}
                  className={`text-left px-3 py-2 border-b border-gray-700 ${
                    c === "name" ? "min-w-64" : ""
                  }`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={r?.db_uuid || `${idx}`}
                className={idx % 2 ? "bg-gray-900" : "bg-gray-950"}
              >
                {columns.map((c) => renderCell(r, c))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function TableView(props) {
  const {
    rowsOverride = null,
    enableExport = true,
    exportFileName = "srg_cards_results.csv",
  } = props;

  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  useEffect(() => {
    let cancelled = false;

    // If rowsOverride is provided, bypass fetching entirely.
    if (Array.isArray(rowsOverride)) {
      setLoading(false);
      setError("");
      setRows(rowsOverride);
      setTotalCount(rowsOverride.length);
      return () => {
        cancelled = true;
      };
    }

    const run = async () => {
      setLoading(true);
      setError("");
      setRows([]);
      setTotalCount(0);

      try {
        const result = await fetchAllRows(filters, () => cancelled);
        if (!result) return;
        setRows(result.rows);
        setTotalCount(result.total);
      } catch (e) {
        console.error(e);
        setError(e?.message || "Failed to load table");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [filters, rowsOverride]);

  const columns = useMemo(() => computeColumns(rows), [rows]);

  const handleDownloadCSV = () => {
    triggerDownload(exportFileName, toCSV(rows, columns), "text/csv;charset=utf-8;");
  };

  const handleDownloadHTML = () => {
    const base = exportFileName.replace(/\.csv$/i, "").replace(/\.html$/i, "");
    triggerDownload(`${base}.html`, toHTMLNoCSS(rows, columns, "SRG Card List"), "text/html;charset=utf-8");
  };

  const hasOverride = Array.isArray(rowsOverride);

  return (
    <div className="min-h-screen flex flex-col text-white">
      <div className="w-full px-4 py-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Results Table</h1>
          <div className="flex items-center gap-2">
            {enableExport && (
            <>
                <button
                onClick={handleDownloadCSV}
                className="px-3 py-2 bg-emerald-700 rounded hover:bg-emerald-600"
                disabled={loading || rows.length === 0}
                title="Download all rows as CSV"
                >
                Download CSV
                </button>
                <button
                onClick={handleDownloadHTML}
                className="px-3 py-2 bg-indigo-700 rounded hover:bg-indigo-600"
                disabled={loading || rows.length === 0}
                >
                Download HTML (no CSS)
                </button>
            </>
            )}
            <Link
              to={`/?${searchParams.toString()}`}
              className="px-3 py-2 bg-gray-800 rounded hover:bg-gray-700"
            >
              ← Back to Grid
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading full result set…</p>
        ) : error ? (
          <p className="text-red-400">{error}</p>
        ) : (
          <ResultsTable
            rows={rows}
            columns={columns}
            totalCount={totalCount}
            hasOverride={hasOverride}
          />
        )}
      </div>
    </div>
  );
}
