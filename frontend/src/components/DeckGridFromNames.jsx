// src/components/DeckGridFromNames.jsx
import { useEffect, useMemo, useState } from "react";
import CardGrid from "./CardGrid";
import Pagination from "./Pagination";
import { slugify } from "../lib/slug";

export default function DeckGridFromNames({
  names = [],
  pageSize = 40, // show up to 40 on page 1; typical decks are ≤ 35
  title = "Deck",
  enableExport = true,
  exportFileName, // optional; defaults to slugified title
}) {
  const [cards, setCards] = useState([]);
  const [notFound, setNotFound] = useState([]);
  const [loading, setLoading] = useState(false);

  // pagination (still works if you ever exceed 40)
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(names.length / pageSize));

  const pageNames = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return names.slice(start, end);
  }, [names, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [names, pageSize]);

  useEffect(() => {
    let cancelled = false;

    const fetchPage = async () => {
      setLoading(true);
      try {
        const fetched = [];
        const missing = [];

        // 1) Batch endpoint first (same as CreateList) – preserves order and includes gender
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
        } catch {
          // ignore; we’ll fall back below
        }

        // Build lookup maps from batch
        const bySlug = new Map();
        const byNameLower = new Map();
        for (const r of batchRows) {
          if (r?.name) {
            bySlug.set(slugify(r.name), r);
            byNameLower.set(String(r.name).toLowerCase(), r);
          }
        }

        // 2) Preserve original list order; fill from batch or fallbacks
        for (const n of pageNames) {
          const s = slugify(n);
          let row = bySlug.get(s) || byNameLower.get(n.toLowerCase());

          // Fallbacks for any misses: slug endpoint → query search
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
            fetched.push({ name: n }); // stub so exports still include the name
            missing.push(n);
          }
        }

        // 3) Enrich pass: ensure competitor rows carry `gender` like CreateList/TableView
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
          } catch {
            // ignore; partial enrich is fine
          }
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
  }, [pageNames]);

  // -------------------------
  // Export helpers (aligned with CreateList/TableView)
  // -------------------------
  const defaultExportName =
    (exportFileName && exportFileName.trim()) || `${slugify(title || "deck")}.csv`;

  // columns visible/ordered similarly to TableView; append useful hidden fields if present
  const columns = useMemo(() => {
    const rows = cards;
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
      "gender", // hidden in UI; we add to export later
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
  }, [cards]);

  const buildExportColumns = () => {
    const rows = cards;
    const cols = [...columns];

    // Include gender if present anywhere OR if any Competitor rows exist (to match CreateList intent)
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

    // Ensure deck_card_number is exported when present, even if not visible
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
    const rows = cards;
    const csvColumns = buildExportColumns();
    const header = csvColumns.map(escapeCSV).join(",");
    const body = rows
      .map((r) => csvColumns.map((c) => escapeCSV(r?.[c])).join(","))
      .join("\n");
    return `${header}\n${body}`;
  };

  const toHTMLNoCSS = (titleStr = "SRG Card List") => {
    const rows = cards;
    const cols = buildExportColumns();
    const thead = `<tr>${cols.map((c) => `<th>${htmlEscape(c)}</th>`).join("")}</tr>`;
    const tbody = rows
      .map((r) => {
        const tds = cols
          .map((c) => {
            let val = r?.[c];
            // IMPORTANT: treat null/undefined as empty BEFORE any stringify, so we never print "null"
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
            {names.length.toLocaleString()} item{names.length === 1 ? "" : "s"}
          </p>
        </div>
        {enableExport && (
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-black"
              onClick={handleExportCsv}
              disabled={loading || cards.length === 0}
              title="Download visible deck as CSV"
            >
              Download CSV
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-black"
              onClick={handleExportHtml}
              disabled={loading || cards.length === 0}
              title="Download visible deck as HTML (no CSS)"
            >
              Download HTML (no CSS)
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-gray-400 mt-4">Loading…</p>
      ) : cards.length === 0 ? (
        <p className="text-gray-400 mt-4">No cards found on this page.</p>
      ) : (
        <CardGrid cards={cards} />
      )}

      {notFound.length > 0 && (
        <p className="mt-3 text-xs text-amber-300">
          Couldn’t find: {notFound.join(", ")}
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

