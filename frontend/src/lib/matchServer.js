// Client seam for player-vs-player games served by the Rust `srg-match-server`.
//
// The trust split: FastAPI (same origin, session cookie) owns identity and mints
// short-lived signed **seat tokens**; the match-server (a *different* origin,
// whose URL FastAPI hands back with the token) only verifies the signature. So a
// PvP call is two hops — mint a token from `/api/rib/matches...`, then call the
// match-server with `Authorization: Bearer <token>`. This module hides both hops;
// callers get plain async methods and never see a token.
//
// Two token flavors mirror the server's:
//   * a create/join token (`sub` only) — used to create a match or join by code;
//   * a per-match seat token (`sub` + match + seat) — used to read state / submit.
// We cache each and re-mint when it's near expiry or the server answers 401.

import { api, ApiError } from "./apiClient";

// key -> { token, server, seat, exp } ; exp is epoch ms. The create/join token
// lives under the empty-string key; per-match tokens under their match id.
const tokenCache = new Map();
const REFRESH_SKEW_MS = 30_000;

async function mintToken(key) {
  const path = key ? `/api/rib/matches/${key}/token` : "/api/rib/matches/token";
  const r = await api.post(path);
  const entry = {
    token: r.token,
    server: r.match_server.replace(/\/$/, ""),
    seat: r.seat ?? null,
    exp: Date.now() + (r.expires_in ?? 0) * 1000,
  };
  tokenCache.set(key, entry);
  return entry;
}

async function tokenFor(key) {
  const hit = tokenCache.get(key);
  if (hit && hit.exp - Date.now() > REFRESH_SKEW_MS) return hit;
  return mintToken(key);
}

// One call to the match-server, authorized by the `key`'s seat token. Re-mints
// once on a 401 (a token that expired mid-session) before giving up. The
// match-server returns JSON on success and a plain-text message on error.
async function call(key, path, { method = "GET", body } = {}) {
  let entry = await tokenFor(key);
  const send = (t) =>
    fetch(`${t.server}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${t.token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let res = await send(entry);
  if (res.status === 401) {
    entry = await mintToken(key);
    res = await send(entry);
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data ? data.detail : data;
    throw new ApiError(res.status, detail);
  }
  return data;
}

// Create a match. `deck` is enriched Deck JSON (seat A). `turnSeconds` is the
// per-turn limit (null/0 = untimed). Returns { match_id, join_code }. Uses a
// create/join token (no seat yet).
export async function createMatch({
  deck,
  seed = 0,
  visibility = "private",
  turnSeconds = null,
}) {
  return call("", "/matches", {
    method: "POST",
    body: { deck_a: deck, seed, visibility, turn_seconds: turnSeconds },
  });
}

// Join a pending match by its id + code, binding seat B. `deck` is enriched Deck
// JSON. Returns { match_id, status }.
export async function joinMatch({ matchId, joinCode, deck }) {
  return call("", `/matches/${matchId}/join`, {
    method: "POST",
    body: { deck_b: deck, join_code: joinCode },
  });
}

// This seat's view of a match: { match_id, seat, status, whose_turn, your_turn,
// finished, decision?, result? }. Uses a per-match seat token.
export async function fetchState(matchId) {
  return call(matchId, `/matches/${matchId}/state`, { method: "GET" });
}

// Submit this seat's decision (the chosen legal index) for `requestId`. Returns
// the fresh state — a client keeps going if it's still your turn, else hands off.
export async function submitDecision(matchId, requestId, choice) {
  return call(matchId, `/matches/${matchId}/submit`, {
    method: "POST",
    body: { request_id: requestId, choice },
  });
}

// Resign this seat — concede the match; the other seat wins by resignation.
// Returns the fresh (finished) state. Uses a per-match seat token, so a player can
// only resign their own seat; the body carries no seat (the server reads it from
// the token).
export async function resignMatch(matchId) {
  return call(matchId, `/matches/${matchId}/resign`, {
    method: "POST",
    body: {},
  });
}

// Drop cached tokens (e.g. on sign-out). Cheap and side-effect-free otherwise.
export function clearTokenCache() {
  tokenCache.clear();
}
