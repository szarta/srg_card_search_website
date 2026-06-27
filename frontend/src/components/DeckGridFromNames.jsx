// src/components/DeckGridFromNames.jsx
import { useEffect, useMemo, useState } from "react";
import CardGrid from "./CardGrid";
import Pagination from "./Pagination";
import { slugify } from "../lib/slug";
import { QRCodeSVG } from "qrcode.react";
import { computeColumns, toCSV, toHTMLNoCSS, triggerDownload } from "../lib/cardExport";

// POST a page of names to the batch endpoint; returns the matched rows (or []).
async function fetchBatchRows(pageNames) {
  try {
    const resp = await fetch("/cards/by-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: pageNames }),
    });
    if (resp.ok) {
      const data = await resp.json();
      return Array.isArray(data?.rows) ? data.rows : [];
    }
  } catch { /* ignore network/parse errors and fall through */ }
  return [];
}

// Index batch rows by slug and lowercased name for quick lookup.
function indexRows(batchRows) {
  const bySlug = new Map();
  const byNameLower = new Map();
  for (const r of batchRows) {
    if (r?.name) {
      bySlug.set(slugify(r.name), r);
      byNameLower.set(String(r.name).toLowerCase(), r);
    }
  }
  return { bySlug, byNameLower };
}

// Resolve a single name: batch index first, then slug lookup, then search fallback.
async function resolveCardByName(n, bySlug, byNameLower) {
  const s = slugify(n);
  let row = bySlug.get(s) || byNameLower.get(n.toLowerCase());
  if (row) return row;

  try {
    const r = await fetch(`/cards/slug/${s}`);
    if (r.ok) row = await r.json();
  } catch { /* ignore network/parse errors and fall through */ }
  if (row) return row;

  try {
    const r2 = await fetch(`/cards?q=${encodeURIComponent(n)}&limit=50`);
    if (r2.ok) {
      const d2 = await r2.json();
      const items = Array.isArray(d2?.items) ? d2.items : [];
      row =
        items.find((c) => slugify(c.name) === s) ||
        items.find((c) => c.name?.toLowerCase() === n.toLowerCase());
    }
  } catch { /* ignore network/parse errors and fall through */ }
  return row || null;
}

// Resolve a page of names into { fetched, missing }. Missing names get a
// placeholder { name } row so the grid still renders a slot for them.
async function resolvePageCards(pageNames) {
  const batchRows = await fetchBatchRows(pageNames);
  const { bySlug, byNameLower } = indexRows(batchRows);

  const fetched = [];
  const missing = [];
  for (const n of pageNames) {
    const row = await resolveCardByName(n, bySlug, byNameLower);
    if (row) {
      fetched.push(row);
    } else {
      fetched.push({ name: n });
      missing.push(n);
    }
  }
  return { fetched, missing };
}

// Share + export action buttons shown in the deck header.
function DeckToolbar({ onShare, sharing, hasRows, enableExport, loading, onExportCsv, onExportHtml }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {/* Share button - positioned with export buttons */}
      {onShare && hasRows && (
        <button
          className="px-3 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white"
          onClick={onShare}
          disabled={sharing}
          title="Create shareable link for this list"
        >
          {sharing ? "Creating..." : "Copy Shareable Link"}
        </button>
      )}

      {/* Export buttons */}
      {enableExport && (
        <>
          <button
            className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-black"
            onClick={onExportCsv}
            disabled={loading || !hasRows}
            title="Download visible deck as CSV"
          >
            Download CSV
          </button>
          <button
            className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-black"
            onClick={onExportHtml}
            disabled={loading || !hasRows}
            title="Download visible deck as HTML (no CSS)"
          >
            Download HTML (no CSS)
          </button>
        </>
      )}
    </div>
  );
}

// Success panel with QR code shown after a shareable link is created.
function SharePanel({ shareUrl }) {
  if (!shareUrl) return null;
  return (
    <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-xl">
      <p className="text-sm font-semibold text-green-800 mb-3">
        Shareable link created and copied to clipboard!
      </p>
      <div className="flex gap-4 items-start">
        {/* QR Code */}
        <div className="flex-shrink-0 bg-white p-3 rounded-lg border border-green-300">
          <QRCodeSVG value={shareUrl} size={160} level="M" includeMargin={false} />
          <p className="text-xs text-center text-gray-600 mt-2">Scan to import</p>
        </div>

        {/* URL and Copy button */}
        <div className="flex-1 min-w-0">
          <label className="text-xs font-medium text-green-800 mb-1 block">Share URL:</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 p-2 text-sm border rounded bg-white text-gray-800"
            />
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="px-3 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded whitespace-nowrap"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Share this link or scan the QR code to import this deck
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DeckGridFromNames({
  names = [],
  rowsOverride = null,
  pageSize = 40,
  title = "Deck",
  enableExport = true,
  exportFileName,
  onShare = null,             // Share function passed from parent
  sharing = false,            // Sharing state
  shareUrl = "",              // Generated share URL
}) {
  const [cards, setCards] = useState([]);
  const [notFound, setNotFound] = useState([]);
  const [loading, setLoading] = useState(false);

  // If we're given rowsOverride (array of card rows), we use that.
  const effectiveRows = Array.isArray(rowsOverride) ? rowsOverride : cards;

  // pagination (still works if you ever exceed 40)
  const baseCount = Array.isArray(rowsOverride) ? rowsOverride.length : names.length;
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(baseCount / pageSize));

  const pageSlice = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    if (Array.isArray(rowsOverride)) {
      return effectiveRows.slice(start, end);
    }
    return effectiveRows;
  }, [effectiveRows, page, pageSize, rowsOverride]);

  useEffect(() => {
    setPage(1);
  }, [names, pageSize, rowsOverride]);

  // Skip fetching entirely if rowsOverride is provided
  useEffect(() => {
    if (Array.isArray(rowsOverride)) {
      setLoading(false);
      setNotFound([]);
      return;
    }

    let cancelled = false;

    const fetchPage = async () => {
      setLoading(true);
      try {
        const start = (page - 1) * pageSize;
        const pageNames = names.slice(start, start + pageSize);
        const { fetched, missing } = await resolvePageCards(pageNames);
        if (!cancelled) {
          setCards(fetched);
          setNotFound(missing);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPage();
    return () => {
      cancelled = true;
    };
  }, [names, page, pageSize, rowsOverride]);

  // Export helpers
  const defaultExportName =
    (exportFileName && exportFileName.trim()) || `${slugify(title || "deck")}.csv`;

  const columns = useMemo(() => computeColumns(effectiveRows), [effectiveRows]);

  const handleExportCsv = () => {
    triggerDownload(defaultExportName, toCSV(effectiveRows, columns), "text/csv;charset=utf-8");
  };

  const handleExportHtml = () => {
    const base = defaultExportName.replace(/\.csv$/i, "");
    triggerDownload(
      `${base}.html`,
      toHTMLNoCSS(effectiveRows, columns, "SRG Card List"),
      "text/html;charset=utf-8"
    );
  };

  return (
    <section className="my-8">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-2xl font-semibold">{title}</h3>
          <p className="text-sm text-gray-400">
            {baseCount.toLocaleString()} item{baseCount === 1 ? "" : "s"}
          </p>
        </div>

        <DeckToolbar
          onShare={onShare}
          sharing={sharing}
          hasRows={effectiveRows.length > 0}
          enableExport={enableExport}
          loading={loading}
          onExportCsv={handleExportCsv}
          onExportHtml={handleExportHtml}
        />
      </div>

      {/* Show share URL success message with QR code */}
      <SharePanel shareUrl={shareUrl} />

      {loading ? (
        <p className="text-gray-400 mt-4">Loading...</p>
      ) : effectiveRows.length === 0 ? (
        <p className="text-gray-400 mt-4">No cards found.</p>
      ) : (
        <CardGrid cards={pageSlice} />
      )}

      {notFound.length > 0 && !rowsOverride && (
        <p className="mt-3 text-xs text-amber-300">
          Couldn't find: {notFound.join(", ")}
        </p>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={(p) => {
            if (p >= 1 && p <= totalPages) setPage(p);
          }}
        />
      )}
    </section>
  );
}
