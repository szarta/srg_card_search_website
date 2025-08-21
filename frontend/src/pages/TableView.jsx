import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

const SAFE_CHUNK = 100;
const COMPETITOR_TYPES = new Set([
  "SingleCompetitorCard",
  "TornadoCompetitorCard",
  "TrioCompetitorCard",
]);

export default function TableView() {
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
      deckCardNumber: obj.deckCardNumber || "",
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
    if (filters.playOrder) {
      const po = filters.playOrder === "Follow Up" ? "Followup" : filters.playOrder;
      q.append("play_order", po);
    }
    if (filters.cardType === "MainDeckCard" && filters.deckCardNumber !== "") {
      const n = parseInt(filters.deckCardNumber, 10);
      if (!Number.isNaN(n)) q.append("deck_card_number", String(n));
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
    const run = async () => {
      setLoading(true);
      setError("");
      setRows([]);
      setTotalCount(0);
      try {
        let limit = SAFE_CHUNK;
        let offset = 0;
        const first = await fetch(`/cards?${buildQuery(limit, offset).toString()}`);
        if (!first.ok) throw new Error(`HTTP ${first.status}`);
        const firstData = await first.json();
        if (cancelled) return;
        const total = Number.isFinite(firstData?.total_count) ? firstData.total_count : 0;
        const acc = Array.isArray(firstData?.items) ? firstData.items.slice() : [];
        const reqs = [];
        for (offset = acc.length; offset < total; offset += limit) {
          const q = buildQuery(limit, offset);
          reqs.push(fetch(`/cards?${q.toString()}`).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          }));
        }
        const chunks = reqs.length ? await Promise.all(reqs) : [];
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
    run();
    return () => { cancelled = true; };
  }, [filters]);

  const columns = useMemo(() => {
    const keys = new Set();
    rows.forEach((r) => Object.keys(r || {}).forEach((k) => keys.add(k)));

    const hiddenAlways = new Set([
      "db_uuid",
      "is_banned",
      "release_set",
      "related_cards",
      "related_finishes",
      "comments",
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

  const toCSV = () => {
    const escape = (val) => {
      if (val === null || val === undefined) return "";
      let s = Array.isArray(val) || typeof val === "object" ? JSON.stringify(val) : String(val);
      if (/[",\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const header = columns.map(escape).join(",");
    const body = rows.map((r) => columns.map((c) => {
      let v = r?.[c];
      if (v === undefined || v === null) {
        if (COMPETITOR_TYPES.has(r?.card_type)) {
          // Fallbacks for competitor stats if nested or capitalized
          const alt =
            r?.stats?.[c] ??
            r?.attributes?.[c] ??
            r?.[c?.toUpperCase?.()] ??
            r?.[c ? c.charAt(0).toUpperCase() + c.slice(1) : c];
          v = alt;
        }
      }
      return escape(v);
    }).join(",")).join("\n");
    return `${header}\n${body}`;
  };

  const handleDownloadCSV = () => {
    const csv = toCSV();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "srg_cards_results.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderCell = (r, c) => {
    let v = r?.[c];
    if ((v === undefined || v === null) && COMPETITOR_TYPES.has(r?.card_type)) {
      const alt =
        r?.stats?.[c] ??
        r?.attributes?.[c] ??
        r?.[c?.toUpperCase?.()] ??
        r?.[c ? c.charAt(0).toUpperCase() + c.slice(1) : c];
      v = alt;
    }
    if (c === "name" && r?.db_uuid) {
      return (
        <td key={c} className="px-3 py-2 border-b border-gray-800 break-all min-w-64">
          <Link className="text-srgPurple hover:underline" to={`/card/${r.db_uuid}`}>
            {String(v ?? "")}
          </Link>
        </td>
      );
    }
    if (c === "srg_url" && typeof v === "string" && /^https?:\/\//i.test(v)) {
      return (
        <td key={c} className="px-3 py-2 border-b border-gray-800 break-all">
          <a href={v} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            {v}
          </a>
        </td>
      );
    }
    if (Array.isArray(v) || (v && typeof v === "object")) {
      try { v = JSON.stringify(v); } catch { v = String(v); }
    }
    return (
      <td key={c} className="px-3 py-2 border-b border-gray-800 break-all">
        {String(v ?? "")}
      </td>
    );
  };

  return (
    <div className="min-h-screen flex flex-col text-white">
      <div className="container mx-auto px-4 py-8 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Results Table</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCSV}
              className="px-3 py-2 bg-emerald-700 rounded hover:bg-emerald-600"
              disabled={loading || rows.length === 0}
              title="Download all rows as CSV"
            >
              Download CSV
            </button>
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
              Showing {rows.length.toLocaleString()} of {totalCount.toLocaleString()} matches
            </p>
            <table className="min-w-full border border-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c}
                      className={`text-left px-3 py-2 border-b border-gray-700 ${c === "name" ? "min-w-64" : ""}`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r?.db_uuid || `${idx}`} className={idx % 2 ? "bg-gray-900" : "bg-gray-950"}>
                    {columns.map((c) => renderCell(r, c))}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
