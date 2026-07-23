// Engine module boundary for Run It Back.
//
// This is the *only* file that imports the vendored WASM `srg-core` engine.
// Everything else (play screen, components) talks to the engine through this
// module, so the engine location (in-browser WASM today, server-side Rust as a
// documented fallback) stays swappable behind one seam.
//
// The vendored pkg is `src/runitback/pkg/{srg_core.js, srg_core_bg.wasm}`, built
// by `invoke release-web` in ~/data/srg_sim from the same commit as the backend
// `srg` binary. See ~/data/srg_sim/FRONTEND_HANDOFF.md.

import init, { WasmSession, version, policies } from "./pkg/srg_core.js";

let _initPromise = null;

// init() is idempotent-safe to call once; memoize so every screen shares one
// instantiated module. Vite resolves the `.wasm` via `new URL(..., import.meta.url)`
// inside srg_core.js and emits it as an asset — no manual path wiring needed.
export function ensureEngine() {
  if (!_initPromise) {
    _initPromise = init().then(() => true);
  }
  return _initPromise;
}

// Engine + schema version stamp: { engine, commit, schemas:{effect_ir, game_log,
// observable_state}, policies:[...] }. Only valid after ensureEngine() resolves.
export function engineVersion() {
  return JSON.parse(version());
}

// Available AI opponent policies, e.g. ["random","heuristic","aggressive","smart","newbie"].
export function enginePolicies() {
  return JSON.parse(policies());
}

// Open a live match. deckA/deckB are enriched Deck JSON objects (from the backend
// `/enriched` endpoint or the vendored sample fixtures). Seat A is the human
// ("remote"); seat B is an AI policy name. Returns a Session wrapper.
//
// Throws a JS Error on bad deck/seat/policy — callers must wrap.
export function openMatch(deckA, deckB, opponentPolicy, seed) {
  const seats = JSON.stringify({ A: "remote", B: opponentPolicy });
  const raw = WasmSession.open(
    JSON.stringify(deckA),
    JSON.stringify(deckB),
    seats,
    BigInt(seed),
  );
  return new Session(raw);
}

// Rehydrate a match from a snapshot string produced by Session.snapshot().
export function restoreMatch(snapshot) {
  return new Session(WasmSession.restore(snapshot));
}

// Thin, JSON-parsing wrapper over the raw WasmSession so screens never touch
// stringified JSON. The AI seat resolves locally and never suspends, so every
// surfaced Step is either the human's decision or the terminal result.
class Session {
  constructor(raw) {
    this._raw = raw;
  }

  // Current step without advancing: { kind:"decision", request } | { kind:"done", result }.
  step() {
    return JSON.parse(this._raw.step());
  }

  // Submit the array index of the chosen legal option; returns the next step.
  submit(index) {
    return JSON.parse(this._raw.submit(index));
  }

  // Opaque string snapshot of the whole match, for persistence / restore.
  snapshot() {
    return this._raw.snapshot();
  }
}

// No-skew check: the vendored WASM and the backend `srg` binary must agree on the
// three schema versions (the enriched-deck shape is driven by effect_ir). We
// compare schema versions, not `commit` (a committed pkg carries its parent
// commit's stamp by construction). Returns { ok, wasm, backend, mismatch:[...] }.
export function checkSchemaSkew(backendInfo) {
  const wasm = engineVersion();
  const keys = ["effect_ir", "game_log", "observable_state"];
  const mismatch = keys.filter(
    (k) => wasm.schemas?.[k] !== backendInfo?.schemas?.[k],
  );
  return {
    ok: mismatch.length === 0,
    wasm: wasm.schemas,
    backend: backendInfo?.schemas ?? null,
    mismatch,
  };
}
