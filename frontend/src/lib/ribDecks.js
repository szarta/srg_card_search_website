// Shared deck-picker options for the Run It Back play screens (solo vs AI and
// PvP). Two vendored sample decks (already enriched) plus the user's stored
// decks, each resolved to enriched Deck JSON on demand — the shape both the WASM
// engine and the match-server's create/join want.

import bullSample from "../runitback/sample/deckA.json";
import faeSample from "../runitback/sample/deckB.json";
import { api } from "./apiClient";

export const SAMPLE_DECKS = [
  {
    id: "sample:bull",
    name: `${bullSample.competitor.name} (sample)`,
    resolve: async () => bullSample,
  },
  {
    id: "sample:fae",
    name: `${faeSample.competitor.name} (sample)`,
    resolve: async () => faeSample,
  },
];

// The full option list: samples + the caller's stored decks (resolved via the
// backend's /enriched endpoint). A failed stored-decks fetch degrades to the
// samples alone rather than blocking play.
export async function loadDeckOptions() {
  const stored = await api.get("/api/rib/decks").catch(() => null);
  const opts = (stored?.decks ?? []).map((d) => ({
    id: `stored:${d.id}`,
    name: d.name,
    resolve: async () => api.get(`/api/rib/decks/${d.id}/enriched`),
  }));
  return [...SAMPLE_DECKS, ...opts];
}
