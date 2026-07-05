// Shared helpers for rendering and exporting card result sets.
// Used by TableView and DeckGridFromNames so column selection and CSV/HTML
// export stay consistent across both views.

export const COMPETITOR_TYPES = new Set([
  "SingleCompetitorCard",
  "TornadoCompetitorCard",
  "TrioCompetitorCard",
]);

// Append a parsed integer query param, skipping empty/invalid values.
export function appendInt(params, key, value) {
  if (value === "" || value === null || value === undefined) return;
  const n = parseInt(value, 10);
  if (!Number.isNaN(n)) params.append(key, String(n));
}

const HIDDEN_ALWAYS = [
  "db_uuid",
  "is_banned",
  "release_set",
  "related_cards",
  "related_finishes",
  "comments",
  "comment",
  "srgpc_url",
];
const MAIN_DECK_FIELDS = ["atk_type", "play_order", "deck_card_number"];
const COMPETITOR_FIELDS = ["power", "agility", "strike", "submission", "grapple", "technique"];

// Union of row keys minus hidden fields, ordered with preferred columns first
// and per-type fields shown only when relevant cards are present.
export function computeColumns(rows) {
  const keys = new Set();
  rows.forEach((r) => Object.keys(r || {}).forEach((k) => keys.add(k)));

  const hiddenAlways = new Set(HIDDEN_ALWAYS);
  const anyMainDeck = rows.some((r) => r?.card_type === "MainDeckCard");
  const anyCompetitor = rows.some((r) => COMPETITOR_TYPES.has(r?.card_type));

  if (!anyMainDeck) MAIN_DECK_FIELDS.forEach((k) => hiddenAlways.add(k));
  if (!anyCompetitor) COMPETITOR_FIELDS.forEach((k) => hiddenAlways.add(k));

  const preferred = [
    "name",
    "card_type",
    ...(anyMainDeck ? MAIN_DECK_FIELDS : []),
    ...(anyCompetitor ? COMPETITOR_FIELDS : []),
    "srg_url",
  ].filter((k) => keys.has(k) && !hiddenAlways.has(k));

  preferred.forEach((k) => keys.delete(k));
  hiddenAlways.forEach((k) => keys.delete(k));

  return [...preferred, ...Array.from(keys).sort()];
}

// Visible columns plus hidden-but-useful fields (deck_card_number) when present.
export function buildExportColumns(rows, columns) {
  const cols = [...columns];
  if (
    rows.some((r) => Object.prototype.hasOwnProperty.call(r, "deck_card_number")) &&
    !cols.includes("deck_card_number")
  ) {
    cols.push("deck_card_number");
  }
  return cols;
}

export function htmlEscape(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Stringify a cell value for export (objects/arrays become JSON, nullish becomes "").
export function stringifyCell(val) {
  if (val === null || val === undefined) return "";
  if (Array.isArray(val) || typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val ?? "");
    }
  }
  return String(val);
}

export function escapeCSV(val) {
  if (val === null || val === undefined) return "";
  let s = Array.isArray(val) || typeof val === "object" ? JSON.stringify(val) : String(val);
  // Match Android app CSV scheme: replace commas with --, escape quotes with "", wrap in quotes
  s = s.replace(/,/g, "--").replace(/"/g, '""');
  return `"${s}"`;
}

export function toCSV(rows, columns) {
  const csvColumns = buildExportColumns(rows, columns);
  const header = csvColumns.map(escapeCSV).join(",");
  const body = rows.map((r) => csvColumns.map((c) => escapeCSV(r?.[c])).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function toHTMLNoCSS(rows, columns, title = "SRG Card List") {
  const cols = buildExportColumns(rows, columns);
  const thead = `<tr>${cols.map((c) => `<th>${htmlEscape(c)}</th>`).join("")}</tr>`;
  const tbody = rows
    .map((r) => {
      const tds = cols.map((c) => `<td>${htmlEscape(stringifyCell(r?.[c]))}</td>`).join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>${htmlEscape(title)}</title>
<table>
  <thead>${thead}</thead>
  <tbody>${tbody}</tbody>
</table>
</html>`;
}

// Trigger a client-side file download for the given content.
export function triggerDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
