// Deck-data helpers for the Run It Back deck editor.
//
// A stored deck's `deck_data` is the same slot structure shared lists use
// (schemas/shared_list_schema.py): { spectacle_type, slots:[{slot_type,
// slot_number, card_uuid}] }. The engine bridge (backend rib_engine.py) reads
// COMPETITOR/ENTRANCE/DECK slots; the editor here builds and parses that shape.
// Card lookups go through the public, no-login batch endpoints the rest of the
// site already uses (/cards/by-names, /cards/by-uuids).

export const SPECTACLE_TYPES = ["NEWMAN", "VALIANT"];
export const COMPETITOR_TYPE = "SingleCompetitorCard"; // engine supports single only
export const ENTRANCE_TYPE = "EntranceCard";

// One card name per non-empty, non-comment line (mirrors CreateList's parser).
export function parseNames(text) {
  return (text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

async function postJson(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Card lookup failed (${res.status})`);
  return res.json();
}

// Resolve card names to rows (fuzzy, order-preserving). { rows, unmatched }.
export async function resolveNames(names) {
  if (!names.length) return { rows: [], unmatched: [] };
  const data = await postJson("/cards/by-names", { names });
  return { rows: data.rows || [], unmatched: data.unmatched || [] };
}

// Resolve stored card uuids back to rows (order-preserving). { rows, missing }.
export async function resolveUuids(uuids) {
  if (!uuids.length) return { rows: [], missing: [] };
  const data = await postJson("/cards/by-uuids", { uuids });
  return { rows: data.rows || [], missing: data.missing || [] };
}

// Assemble a deck_data payload from resolved uuids. slot_number carries deck
// order (the engine sorts DECK slots by it); COMPETITOR/ENTRANCE use 0.
export function buildDeckData({ spectacleType, competitorUuid, entranceUuid, deckUuids }) {
  const slots = [];
  if (competitorUuid) slots.push({ slot_type: "COMPETITOR", slot_number: 0, card_uuid: competitorUuid });
  if (entranceUuid) slots.push({ slot_type: "ENTRANCE", slot_number: 0, card_uuid: entranceUuid });
  deckUuids.forEach((u, i) => slots.push({ slot_type: "DECK", slot_number: i + 1, card_uuid: u }));
  return { spectacle_type: spectacleType || "NEWMAN", slots };
}

// Split a stored deck_data back into editor fields (uuid form).
export function splitDeckData(deckData) {
  const slots = deckData?.slots || [];
  const deck = slots
    .filter((s) => s.slot_type === "DECK")
    .sort((a, b) => (a.slot_number || 0) - (b.slot_number || 0))
    .map((s) => s.card_uuid);
  return {
    spectacleType: deckData?.spectacle_type || "NEWMAN",
    competitorUuid: slots.find((s) => s.slot_type === "COMPETITOR")?.card_uuid || null,
    entranceUuid: slots.find((s) => s.slot_type === "ENTRANCE")?.card_uuid || null,
    deckUuids: deck,
  };
}

// Count of main-deck cards in a stored deck_data (for the deck list summary).
export function deckCardCount(deckData) {
  return (deckData?.slots || []).filter((s) => s.slot_type === "DECK").length;
}
