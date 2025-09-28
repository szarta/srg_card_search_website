// src/components/DeckGridFromNames.jsx
import { useEffect, useMemo, useState } from "react";
import CardGrid from "./CardGrid";
import Pagination from "./Pagination";
import { slugify } from "../lib/slug";

export default function DeckGridFromNames({
  names = [],
  rowsOverride = null,
  pageSize = 40,
  title = "Deck",
  enableExport = true,
  exportFileName,
  onShare = null,             // NEW: share function passed from parent
  sharing = false,            // NEW: sharing state
  shareUrl = "",              // NEW: generated share URL
  listName = "",              // NEW: list name for sharing
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
        const fetched = [];
        const missing = [];

        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const pageNames = names.slice(start, end);

        let batchRows = [];
        try {
          const resp = await fetch("/cards/by-names", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ names: pageNames }),
          });
          if (resp.ok) {
            const data = await resp.json();
            batchRows = Array.isArray(data?.rows) ? data.rows : [];
          }
        } catch {}

        const bySlug = new Map();
        const byNameLower = new Map();
        for (const r of batchRows) {
          if (r?.name) {
            bySlug.set(slugify(r.name), r);
            byNameLower.set(String(r.name).toLowerCase(), r);
          }
        }

        for (const n of pageNames) {
          const s = slugify(n);
          let row = bySlug.get(s) || byNameLower.get(n.toLowerCase());

          if (!row) {
            try {
              const r = await fetch(`/cards/slug/${s}`);
              if (r.ok) row = await r.json();
            } catch {}
          }
          if (!row) {
            try {
              const r2 = await fetch(`/cards?q=${encodeURIComponent(n)}&limit=50`);
              if (r2.ok) {
                const d2 = await r2.json();
                const items = Array.isArray(d2?.items) ? d2.items : [];
                row =
                  items.find((c) => slugify(c.name) === s) ||
                  items.find((c) => c.name?.toLowerCase() === n.toLowerCase());
              }
            } catch {}
          }

          if (row) {
            fetched.push(row);
          } else {
            fetched.push({ name: n });
            missing.push(n);
          }
        }

        const COMP_TYPES = new Set([
          "SingleCompetitorCard",
          "TornadoCompetitorCard",
          "TrioCompetitorCard",
        ]);
        const toEnrich = fetched
          .filter(
            (r) =>
              r &&
              COMP_TYPES.has(r.card_type) &&
              !Object.prototype.hasOwnProperty.call(r, "gender")
          )
          .map((r) => r.name)
          .filter(Boolean);

        if (toEnrich.length) {
          try {
            const resp = await fetch("/cards/by-names", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ names: Array.from(new Set(toEnrich)) }),
            });
            if (resp.ok) {
              const data = await resp.json();
              const enrichMap = new Map();
              for (const r of Array.isArray(data?.rows) ? data.rows : []) {
                if (r?.name) enrichMap.set(String(r.name).toLowerCase(), r);
              }
              for (let i = 0; i < fetched.length; i++) {
                const row = fetched[i];
                if (!row || !row.name) continue;
                if (
                  COMP_TYPES.has(row.card_type) &&
                  !Object.prototype.hasOwnProperty.call(row, "gender")
                ) {
                  const got = enrichMap.get(String(row.name).toLowerCase());
                  if (got) {
                    fetched[i] = { ...got, ...row, gender: got.gender ?? row.gender };
                  }
                }
              }
            }
          } catch {}
        }

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

  const columns = useMemo(() => {
    const rows = effectiveRows;
    const keys = new Set();
    rows.forEach((r) => Object.keys(r || {}).forEach((k) => keys.add(k)));

    const hiddenAlways = new Set([
      "db_uuid",
      "is_banned",
      "release_set",
      "related_cards",
      "related_finishes",
      "comments",
      "comment",
      "srgpc_url",
      "gender",
    ]);

    const anyMainDeck = rows.some((r) => r?.card_type === "MainDeckCard");
    const COMPETITOR_TYPES = new Set([
      "SingleCompetitorCard",
      "TornadoCompetitorCard",
      "TrioCompetitorCard",
    ]);
    const anyCompetitor = rows.some((r) => COMPETITOR_TYPES.has(r?.card_type));

    const mainDeckFields = ["atk_type", "play_order", "deck_card_number"];
    const competitorFields = [
      "power",
      "agility",
      "strike",
      "submission",
      "grapple",
      "technique",
    ];

    if (!anyMainDeck) mainDeckFields.forEach((k) => hiddenAlways.add(k));
    if (!anyCompetitor) competitorFields.forEach((k) => hiddenAlways.add(k));

    const preferred = [
      "name",
      "card_type",
      ...(anyMainDeck ? mainDeckFields : []),
      ...(anyCompetitor ? competitorFields : []),
      "srg_url",
    ].filter((k) => keys.has(k) && !hiddenAlways.has(k));

    preferred.forEach((k) => keys.delete(k));
    hiddenAlways.forEach((k) => keys.delete(k));

    return [...preferred, ...Array.from(keys).sort()];
  }, [effectiveRows]);

  const buildExportColumns = () => {
    const rows = effectiveRows;
    const cols = [...columns];

    const COMP_TYPES = new Set([
      "SingleCompetitorCard",
      "TornadoCompetitorCard",
      "TrioCompetitorCard",
    ]);
    if (
      (rows.some((r) => Object.prototype.hasOwnProperty.call(r, "gender")) ||
        rows.some((r) => COMP_TYPES.has(r?.card_type))) &&
      !cols.includes("gender")
    ) {
      cols.push("gender");
    }

    if (
      rows.some((r) => Object.prototype.hasOwnProperty.call(r, "deck_card_number")) &&
      !cols.includes("deck_card_number")
    ) {
      cols.push("deck_card_number");
    }
    return cols;
  };

  const htmlEscape = (v) => {
    if (v === null || v === undefined) return "";
    return String(v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  };

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return "";
    let s = Array.isArray(val) || typeof val === "object" ? JSON.stringify(val) : String(val);
    if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const toCSV = () => {
    const rows = effectiveRows;
    const csvColumns = buildExportColumns();
    const header = csvColumns.map(escapeCSV).join(",");
    const body = rows
      .map((r) => csvColumns.map((c) => escapeCSV(r?.[c])).join(","))
      .join("\n");
    return `${header}\n${body}`;
  };

  const toHTMLNoCSS = (titleStr = "SRG Card List") => {
    const rows = effectiveRows;
    const cols = buildExportColumns();
    const thead = `<tr>${cols.map((c) => `<th>${htmlEscape(c)}</th>`).join("")}</tr>`;
    const tbody = rows
      .map((r) => {
        const tds = cols
          .map((c) => {
            let val = r?.[c];
            if (val === null || val === undefined) {
              val = "";
            } else if (Array.isArray(val) || typeof val === "object") {
              try {
                val = JSON.stringify(val);
              } catch {
                val = String(val ?? "");
              }
            }
            return `<td>${htmlEscape(val)}</td>`;
          })
          .join("");
        return `<tr>${tds}</tr>`;
      })
      .join("");
    return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>${htmlEscape(titleStr)}</title>
<table>
  <thead>${thead}</thead>
  <tbody>${tbody}</tbody>
</table>
</html>`;
  };

  const download = (filename, mime, data) => {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const csv = toCSV();
    download(defaultExportName, "text/csv;charset=utf-8", csv);
  };

  const handleExportHtml = () => {
    const html = toHTMLNoCSS("SRG Card List");
    const base = defaultExportName.replace(/\.csv$/i, "");
    download(`${base}.html`, "text/html;charset=utf-8", html);
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

        <div className="flex gap-2 flex-wrap">
          {/* Share button - only show if onShare function is provided and we have cards */}
          {onShare && effectiveRows.length > 0 && (
            <button
              className="px-3 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white"
              onClick={onShare}
              disabled={sharing}
              title="Create shareable link for this list"
            >
              {sharing ? "Creating..." : "Create Shareable Link"}
            </button>
          )}

          {/* Export buttons */}
          {enableExport && (
            <>
              <button
                className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-black"
                onClick={handleExportCsv}
                disabled={loading || effectiveRows.length === 0}
                title="Download visible deck as CSV"
              >
                Download CSV
              </button>
              <button
                className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-black"
                onClick={handleExportHtml}
                disabled={loading || effectiveRows.length === 0}
                title="Download visible deck as HTML (no CSS)"
              >
                Download HTML (no CSS)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Show share URL success message */}
      {shareUrl && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-sm font-semibold text-green-800 mb-2">
            Shareable link created and copied to clipboard!
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 p-2 text-sm border rounded bg-white"
            />
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              className="px-3 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded"
            >
              Copy
            </button>
          </div>
        </div>
      )}

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
