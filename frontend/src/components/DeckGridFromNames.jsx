// src/components/DeckGridFromNames.jsx
import { useEffect, useMemo, useState } from "react";
import CardGrid from "./CardGrid";
import Pagination from "./Pagination";
import { slugify } from "../lib/slug";

export default function DeckGridFromNames({
  names = [],
  pageSize = 40,                 // <= show up to 40 on page 1
  title = "Deck",
  enableExport = true,
  exportFileName,                // optional; defaults to slugified title
}) {
  const [cards, setCards] = useState([]);
  const [notFound, setNotFound] = useState([]);
  const [loading, setLoading] = useState(false);

  // pagination
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(names.length / pageSize));

  const pageNames = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return names.slice(start, end);
  }, [names, page, pageSize]);

  useEffect(() => {
    let cancelled = false;
    const fetchPage = async () => {
      setLoading(true);
      try {
        const fetched = [];
        const missing = [];
        // Fetch one-by-one via slug first (mirrors CardLink/CardImage behavior)
        for (const n of pageNames) {
          const s = slugify(n);
          try {
            const r = await fetch(`/cards/slug/${s}`);
            if (!r.ok) throw new Error(`slug miss for ${n}`);
            const data = await r.json();
            fetched.push(data);
          } catch {
            // fallback: search exact name among top 50
            try {
              const r2 = await fetch(`/cards?q=${encodeURIComponent(n)}&limit=50`);
              const d2 = r2.ok ? await r2.json() : { items: [] };
              const items = Array.isArray(d2.items) ? d2.items : [];
              const bySlug = items.find((c) => slugify(c.name) === s);
              const byName = items.find((c) => c.name?.toLowerCase() === n.toLowerCase());
              if (bySlug || byName) fetched.push(bySlug || byName);
              else {
                // store a stub so exports still include the name
                fetched.push({ name: n });
                missing.push(n);
              }
            } catch {
              fetched.push({ name: n });
              missing.push(n);
            }
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
    return () => { cancelled = true; };
  }, [pageNames]);

  useEffect(() => {
    // reset page if names list changes
    setPage(1);
  }, [names, pageSize]);

  // -------------------------
  // Export helpers (aligned to TableView / CreateList behavior)
  // -------------------------
  const defaultExportName =
    (exportFileName && exportFileName.trim()) || `${slugify(title || "deck")}.csv`;

  // Build "visible" columns (union of keys minus hidden, with preferred order),
  // then append some useful-but-hidden fields when present (gender, deck_card_number).
  const columns = useMemo(() => {
    const rows = cards;
    const keys = new Set();
    rows.forEach((r) => Object.keys(r || {}).forEach((k) => keys.add(k)));

    // Hide for all cards (mirror TableView) + keep gender hidden in UI but includable in CSV/HTML
    const hiddenAlways = new Set([
      "db_uuid",
      "is_banned",
      "release_set",
      "related_cards",
      "related_finishes",
      "comments",
      "comment",
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
    const competitorFields = ["power", "agility", "strike", "submission", "grapple", "technique"];

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
    if (rows.some((r) => Object.prototype.hasOwnProperty.call(r, "gender")) && !cols.includes("gender")) {
      cols.push("gender");
    }
    if (rows.some((r) => Object.prototype.hasOwnProperty.call(r, "deck_card_number")) && !cols.includes("deck_card_number")) {
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
    const body = rows.map((r) => csvColumns.map((c) => escapeCSV(r?.[c])).join(",")).join("\n");
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
            if (Array.isArray(val) || typeof val === "object") {
              try {
                val = JSON.stringify(val);
              } catch {
                /* ignore */
              }
            }
            return `<td>${htmlEscape(val ?? "")}</td>`;
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

