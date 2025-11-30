import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

const SAFE_CHUNK = 100; // stay within backend validators

const COMPETITOR_TYPES = new Set([
  "SingleCompetitorCard",
  "TornadoCompetitorCard",
  "TrioCompetitorCard",
]);

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

  const filters = useMemo(() => {
    const obj = Object.fromEntries(searchParams.entries());
    return {
      query: obj.query || "",
      cardType: obj.cardType || "",
      atkType: obj.atkType || "",
      playOrder: obj.playOrder || "",
      deckCardNumberMin: obj.deckCardNumberMin || "1",
      deckCardNumberMax: obj.deckCardNumberMax || "27",
      division: obj.division || "",
      gender: obj.gender || "",
      power: obj.power || "",
      agility: obj.agility || "",
      strike: obj.strike || "",
      submission: obj.submission || "",
      grapple: obj.grapple || "",
      technique: obj.technique || "",
    };
  }, [searchParams]);

  const buildQuery = (limit, offset) => {
    const q = new URLSearchParams();

    if (filters.query) q.append("q", filters.query);
    if (filters.cardType) q.append("card_type", filters.cardType);
    if (filters.atkType) q.append("atk_type", filters.atkType);
    if (filters.division) q.append("division", filters.division);
    if (filters.gender) q.append("gender", filters.gender); // only applies to Singles; harmless otherwise

    if (filters.playOrder) {
      const po = filters.playOrder === "Follow Up" ? "Followup" : filters.playOrder;
      q.append("play_order", po);
    }

    if (filters.cardType === "MainDeckCard") {
      if (filters.deckCardNumberMin !== "" && filters.deckCardNumberMin !== null && filters.deckCardNumberMin !== undefined) {
        const n = parseInt(filters.deckCardNumberMin, 10);
        if (!Number.isNaN(n)) q.append("deck_card_number_min", String(n));
      }
      if (filters.deckCardNumberMax !== "" && filters.deckCardNumberMax !== null && filters.deckCardNumberMax !== undefined) {
        const n = parseInt(filters.deckCardNumberMax, 10);
        if (!Number.isNaN(n)) q.append("deck_card_number_max", String(n));
      }
    }

    ["power", "agility", "strike", "submission", "grapple", "technique"].forEach((k) => {
      const v = filters[k];
      if (v !== "" && v !== null && v !== undefined) {
        const n = parseInt(v, 10);
        if (!Number.isNaN(n)) q.append(k, String(n));
      }
    });

    q.append("limit", String(limit));
    q.append("offset", String(offset));
    return q;
  };

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

    const fetchAll = async () => {
      setLoading(true);
      setError("");
      setRows([]);
      setTotalCount(0);

      try {
        let limit = SAFE_CHUNK;
        let offset = 0;

        // first call to get total_count
        let firstResp = await fetch(`/cards?${buildQuery(limit, offset).toString()}`);
        if (!firstResp.ok) throw new Error(`HTTP ${firstResp.status}`);
        const firstData = await firstResp.json();
        if (cancelled) return;

        const total = Number.isFinite(firstData?.total_count) ? firstData.total_count : 0;
        const acc = Array.isArray(firstData?.items) ? firstData.items.slice() : [];

        // remaining chunks
        const requests = [];
        for (offset = acc.length; offset < total; offset += limit) {
          const q = buildQuery(limit, offset);
          requests.push(
            fetch(`/cards?${q.toString()}`).then((r) => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r.json();
            })
          );
        }

        const chunks = requests.length ? await Promise.all(requests) : [];
        if (cancelled) return;

        for (const d of chunks) {
          if (Array.isArray(d?.items)) acc.push(...d.items);
        }

        setRows(acc);
        setTotalCount(total);
      } catch (e) {
        console.error(e);
        setError(e?.message || "Failed to load table");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [filters, rowsOverride]);

  // Columns: union of keys minus hidden (with per-type visibility)
  const columns = useMemo(() => {
    const keys = new Set();
    rows.forEach((r) => Object.keys(r || {}).forEach((k) => keys.add(k)));

    // Always hide for all cards
    const hiddenAlways = new Set([
      "db_uuid",
      "is_banned",
      "release_set",
      "related_cards",
      "related_finishes",
      "comments",
      "comment",
      "srgpc_url",
      "gender", // keep hidden in UI, include in CSV if present
    ]);

    const anyMainDeck = rows.some((r) => r?.card_type === "MainDeckCard");
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
  }, [rows]);

const buildExportColumns = () => {
  const cols = [...columns];
  if (rows.some(r => Object.prototype.hasOwnProperty.call(r, "gender")) && !cols.includes("gender")) {
    cols.push("gender");
  }
  if (rows.some(r => Object.prototype.hasOwnProperty.call(r, "deck_card_number")) && !cols.includes("deck_card_number")) {
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


const toHTMLNoCSS = (title = "SRG Card List") => {
    const cols = buildExportColumns();
    const thead = `<tr>${cols.map(c => `<th>${htmlEscape(c)}</th>`).join("")}</tr>`;
    const tbody = rows.map(r => {
      const tds = cols.map(c => {
        let val = r?.[c];
        // treat null/undefined as empty BEFORE stringify so we never print "null"
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
      }).join("");
      return `<tr>${tds}</tr>`;
    }).join("");

    return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>${htmlEscape(title)}</title>
<table>
  <thead>${thead}</thead>
  <tbody>${tbody}</tbody>
</table>
</html>`;
};

const downloadHTMLNoCSS = (filenameBase = "srg_cards") => {
  const html = toHTMLNoCSS("SRG Card List");
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameBase.replace(/\.csv$/i, "").replace(/\.html$/i, "") + ".html";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};


  const escapeCSV = (val) => {
    if (val === null || val === undefined) return "";
    let s = Array.isArray(val) || typeof val === "object" ? JSON.stringify(val) : String(val);
    if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const toCSV = () => {
    // CSV columns = visible columns + include hidden-but-useful fields when present
    const csvColumns = (() => {
      const cols = [...columns];
      // include gender if present anywhere
      if (rows.some(r => Object.prototype.hasOwnProperty.call(r, "gender")) && !cols.includes("gender")) {
        cols.push("gender");
      }
      // ensure deck_card_number is exported when present, even if not visible
      if (rows.some(r => Object.prototype.hasOwnProperty.call(r, "deck_card_number")) && !cols.includes("deck_card_number")) {
        cols.push("deck_card_number");
      }
      return cols;
    })();

    const header = csvColumns.map(escapeCSV).join(",");
    const body = rows.map((r) => csvColumns.map((c) => escapeCSV(r?.[c])).join(",")).join("\n");
    return `${header}\n${body}`;
  };

  const handleDownloadCSV = () => {
    const csv = toCSV();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderCell = (r, c) => {
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
                onClick={() => downloadHTMLNoCSS(exportFileName)}
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
          <>
            <p className="text-gray-300 mb-2">
              {hasOverride
                ? `Showing ${rows.length.toLocaleString()} items`
                : `Showing ${rows.length.toLocaleString()} of ${totalCount.toLocaleString()} matches`}
            </p>

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
        )}
      </div>
    </div>
  );
}

