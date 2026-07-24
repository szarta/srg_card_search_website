// Run It Back — the in-browser play screen.
//
// Flow: pick your deck + an opponent deck + an AI policy + a seed → the engine
// opens a WASM match (you are seat A "remote", the AI is seat B) → we render each
// decision from observable_state and submit the chosen legal index until a `done`
// result. The engine runs entirely in the browser (see runitback/engine.js);
// enriched decks come from the backend (or the vendored sample fixtures).

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../lib/apiClient";
import {
  ensureEngine,
  enginePolicies,
  engineVersion,
  checkSchemaSkew,
  openMatch,
} from "../../runitback/engine";
import bullSample from "../../runitback/sample/deckA.json";
import faeSample from "../../runitback/sample/deckB.json";
import Board from "./components/Board.jsx";
import DecisionPanel from "./components/DecisionPanel.jsx";
import { RollOff, actionLabel } from "./components/FrameView.jsx";

// The vendored sample decks are already enriched — resolve to them directly.
// Stored decks resolve by fetching the backend's /enriched endpoint on demand.
const SAMPLE_DECKS = [
  { id: "sample:bull", name: `${bullSample.competitor.name} (sample)`, resolve: async () => bullSample },
  { id: "sample:fae", name: `${faeSample.competitor.name} (sample)`, resolve: async () => faeSample },
];

const fmt = (n) => (n > 0 ? `+${n}` : `${n}`);

// Load the engine (WASM), its version/policy list, the backend schema stamp for
// the no-skew check, and the user's stored decks. Engine failure is fatal (no
// play); the side loads degrade to no-ops. Kept as a hook so Play stays a thin
// render over the resulting state.
function useEngineSetup() {
  const [engineReady, setEngineReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [skew, setSkew] = useState(null);
  const [version, setVersion] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [storedDecks, setStoredDecks] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureEngine();
        if (!alive) return;
        setEngineReady(true);
        setVersion(engineVersion());
        setPolicies(enginePolicies());
      } catch (e) {
        if (alive) setLoadError(`Failed to load the game engine: ${e}`);
        return;
      }
      const info = await api.get("/api/decks/engine-info").catch(() => null);
      if (alive && info) setSkew(checkSchemaSkew(info));
      const decks = await api.get("/api/rib/decks").catch(() => null);
      if (alive && decks) setStoredDecks(decks.decks ?? []);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return { engineReady, loadError, skew, version, policies, storedDecks };
}

// The stored deck (if any) to preselect from a ?your=<id> deep link.
function deepLinkDeckId(requestedYourId, deckOptions) {
  const id = `stored:${requestedYourId}`;
  return requestedYourId && deckOptions.some((d) => d.id === id) ? id : null;
}

export default function Play() {
  const [searchParams] = useSearchParams();
  const requestedYourId = searchParams.get("your");
  const { engineReady, loadError, skew, version, policies, storedDecks } = useEngineSetup();

  const deckOptions = useMemo(() => {
    const stored = storedDecks.map((d) => ({
      id: `stored:${d.id}`,
      name: d.name,
      resolve: async () => api.get(`/api/rib/decks/${d.id}/enriched`),
    }));
    return [...SAMPLE_DECKS, ...stored];
  }, [storedDecks]);

  if (loadError) {
    return (
      <Shell>
        <div className="rounded border border-rose-600 bg-rose-950/60 p-3 text-sm text-rose-200">
          {loadError}
        </div>
      </Shell>
    );
  }

  if (!engineReady) {
    return (
      <Shell>
        <div className="text-gray-400">Loading engine…</div>
      </Shell>
    );
  }

  return (
    <Shell>
      <PlaySession
        deckOptions={deckOptions}
        policies={policies}
        version={version}
        skew={skew}
        initialYourId={deepLinkDeckId(requestedYourId, deckOptions)}
      />
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Play</h1>
        <Link to="/run-it-back" className="text-sm text-gray-400 hover:text-srgPurple">
          ← Run It Back
        </Link>
      </div>
      {children}
    </div>
  );
}

// The setup form and, once a match is open, the live board + decision loop.
function PlaySession({ deckOptions, policies, version, skew, initialYourId }) {
  const session = useRef(null);
  const decisionsRef = useRef([]); // human decision indices, in order (for replay)
  const matchInfoRef = useRef(null); // { seed, participants } captured at open
  const [step, setStep] = useState(null);
  // The engine's observable-frame sequence so far. observable_state describes the
  // board but says nothing about the roll-off or what the AI just did between
  // your decisions, so the frames are what makes the turn legible while playing.
  const [frames, setFrames] = useState([]);
  const seenRef = useRef(0); // frames already shown before the latest decision
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved

  // Setup form state. Defaults hit the golden path: Bull vs Fae, heuristic, seed 7.
  const [yourDeckId, setYourDeckId] = useState(initialYourId ?? deckOptions[0]?.id ?? "");
  const [oppDeckId, setOppDeckId] = useState(deckOptions[1]?.id ?? deckOptions[0]?.id ?? "");
  const [policy, setPolicy] = useState(policies.includes("heuristic") ? "heuristic" : policies[0] ?? "random");
  // Seed is kept as a raw string so the field can be cleared while typing without
  // snapping to 0 (Number("") === 0); it's coerced to a u64-ish number at start.
  const [seed, setSeed] = useState("7");

  // The deep-linked deck (?your=<id>) may resolve after this component mounts
  // (the stored-decks fetch finishes after the engine is ready), so apply it once
  // it's a real option rather than only at initial state.
  useEffect(() => {
    if (initialYourId) setYourDeckId(initialYourId);
  }, [initialYourId]);

  const start = async () => {
    setError(null);
    setStarting(true);
    try {
      const your = deckOptions.find((d) => d.id === yourDeckId);
      const opp = deckOptions.find((d) => d.id === oppDeckId);
      const [deckA, deckB] = await Promise.all([your.resolve(), opp.resolve()]);
      const seedNum = Number.parseInt(seed, 10);
      const usedSeed = Number.isFinite(seedNum) ? seedNum : 0;
      session.current = openMatch(deckA, deckB, policy, usedSeed);
      matchInfoRef.current = {
        seed: usedSeed,
        participants: buildParticipants(deckA, deckB, your, opp, policy),
      };
      decisionsRef.current = [];
      seenRef.current = 0;
      setSaveState("idle");
      setStep(session.current.step());
      setFrames(session.current.frames());
    } catch (e) {
      setError(errText(e));
      setStep(null);
    } finally {
      setStarting(false);
    }
  };

  const submit = (i) => {
    try {
      decisionsRef.current.push(i);
      // Mark everything shown so far as read, so the feed can highlight only
      // what the engine and the AI did in response to this move.
      seenRef.current = frames.length;
      setStep(session.current.submit(i));
      setFrames(session.current.frames());
    } catch (e) {
      setError(errText(e));
    }
  };

  const quit = () => {
    session.current = null;
    setStep(null);
    setFrames([]);
    seenRef.current = 0;
    setError(null);
    setSaveState("idle");
  };

  // Persist the finished game (full, re-simulatable: snapshot + seed + decisions).
  const saveGame = async () => {
    if (!session.current || step?.kind !== "done") return;
    setSaveState("saving");
    try {
      const snapshot = session.current.snapshot();
      const payload = buildGamePayload(
        step.result,
        version,
        matchInfoRef.current,
        decisionsRef.current,
        snapshot,
      );
      await api.post("/api/rib/games", payload);
      setSaveState("saved");
    } catch (e) {
      setError(errText(e));
      setSaveState("idle");
    }
  };

  // Live match view.
  if (step) {
    return (
      <MatchView
        step={step}
        frames={frames}
        since={seenRef.current}
        onSubmit={submit}
        onQuit={quit}
        onRematch={start}
        onSave={saveGame}
        saveState={saveState}
        error={error}
        busy={starting}
      />
    );
  }

  // Setup form.
  return (
    <div className="space-y-4">
      <SkewBanner skew={skew} version={version} />
      {error && (
        <div className="rounded border border-rose-600 bg-rose-950/60 p-2 text-sm text-rose-200">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your deck">
          <Select value={yourDeckId} onChange={setYourDeckId} options={deckOptions.map((d) => [d.id, d.name])} />
        </Field>
        <Field label="Opponent deck">
          <Select value={oppDeckId} onChange={setOppDeckId} options={deckOptions.map((d) => [d.id, d.name])} />
        </Field>
        <Field label="Opponent AI">
          <Select value={policy} onChange={setPolicy} options={policies.map((p) => [p, p])} />
        </Field>
        <Field label="Seed">
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-gray-100"
          />
        </Field>
      </div>
      <button
        onClick={start}
        disabled={starting || !yourDeckId || !oppDeckId}
        className="rounded-md border border-srgPurple bg-srgPurple/30 px-4 py-2 font-medium text-white hover:bg-srgPurple/50 disabled:opacity-50"
      >
        {starting ? "Starting…" : "Start match"}
      </button>
    </div>
  );
}

const SEAT_LABELS = { A: "You", B: "Opponent" };

// Competitor names for the roll-off panel, read off the live projection.
function liveNames(obs) {
  return {
    A: obs?.players?.A?.competitor?.name ?? "You",
    B: obs?.players?.B?.competitor?.name ?? "Opponent",
  };
}

// What the engine and the AI did since your last move. Cheap to read (the frame
// sequence is re-derived each step) and it is the only place the opponent's play
// is spelled out — the board alone makes you infer it.
function ActionFeed({ frames, since }) {
  const fresh = frames.slice(since);
  if (!fresh.length) return null;
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-3">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">Since your last move</div>
      <ul className="space-y-0.5 text-sm text-gray-300">
        {fresh.map((f) => (
          <li key={f.seq}>
            <span className="mr-2 text-[10px] uppercase tracking-wide text-gray-600">{f.action?.type}</span>
            {actionLabel(f.action)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MatchView({ step, frames, since, onSubmit, onQuit, onRematch, onSave, saveState, error, busy }) {
  const done = step.kind === "done";
  const req = done ? null : step.request;
  const obs = req?.observable_state;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        {obs ? (
          <div className="flex gap-4 text-gray-400">
            <span>turn {obs.turn_no}</span>
            <span>
              crowd meter <span className="font-mono text-gray-200">{fmt(obs.crowd_meter)}</span>
            </span>
            <span>active {obs.active}</span>
          </div>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button onClick={onRematch} className="rounded border border-gray-600 px-3 py-1 text-gray-200 hover:bg-gray-800">
            New match
          </button>
          <button onClick={onQuit} className="rounded border border-gray-700 px-3 py-1 text-gray-400 hover:bg-gray-800">
            Quit
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-rose-600 bg-rose-950/60 p-2 text-sm text-rose-200">{error}</div>
      )}

      {done ? (
        <Result result={step.result} onSave={onSave} saveState={saveState} />
      ) : (
        <>
          <RollOff
            frames={frames}
            at={frames.length - 1}
            names={liveNames(obs)}
            seatLabels={SEAT_LABELS}
          />
          <ActionFeed frames={frames} since={since} />
          <Board label="Opponent" view={obs.players.B} isSelf={false} isActive={obs.active === "B"} />
          <Board label="You" view={obs.players.A} isSelf isActive={obs.active === "A"} />
          <DecisionPanel request={req} onSubmit={onSubmit} busy={busy} />
        </>
      )}
    </div>
  );
}

function Result({ result, onSave, saveState }) {
  const you = result.winner === "A";
  const draw = result.winner === "draw";
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-6 text-center">
      <div className={`text-2xl font-bold ${draw ? "text-gray-300" : you ? "text-emerald-400" : "text-rose-400"}`}>
        {draw ? "Draw" : you ? "You win" : "You lose"}
      </div>
      <div className="mt-1 text-gray-400">
        by {result.reason} in {result.turns} turns
      </div>
      <div className="mt-4">
        {saveState === "saved" ? (
          <span className="text-sm text-emerald-400">
            Saved ✓ —{" "}
            <Link to="/run-it-back/games" className="underline hover:text-emerald-300">
              your games
            </Link>
          </span>
        ) : (
          <button
            onClick={onSave}
            disabled={saveState === "saving"}
            className="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-100 hover:bg-gray-700 disabled:opacity-50"
          >
            {saveState === "saving" ? "Saving…" : "Save this game"}
          </button>
        )}
      </div>
    </div>
  );
}

const errText = (e) => String(e?.detail ?? e?.message ?? e);

// Denormalized participant metadata captured at match open, for record display.
function buildParticipants(deckA, deckB, your, opp, policy) {
  return {
    A: { competitor: deckA.competitor?.name ?? null, deck_name: your?.name ?? null },
    B: { competitor: deckB.competitor?.name ?? null, deck_name: opp?.name ?? null, policy },
  };
}

// Assemble the persisted record for a finished site game. Full information:
// the engine snapshot re-simulates it, and seed + decisions replay it directly.
function buildGamePayload(result, version, matchInfo, decisions, snapshot) {
  return {
    information_view: "full",
    source: "site",
    result,
    engine_version: version ?? null,
    participants: matchInfo?.participants ?? null,
    seed: matchInfo ? String(matchInfo.seed) : null,
    decisions,
    snapshot,
  };
}

function SkewBanner({ skew, version }) {
  if (!skew) return null;
  if (skew.ok) {
    return (
      <p className="text-xs text-gray-500">
        engine {version?.engine} · schemas effect_ir {version?.schemas?.effect_ir} · matched with backend ✓
      </p>
    );
  }
  return (
    <div className="rounded border border-amber-600 bg-amber-950/50 p-2 text-xs text-amber-200">
      Engine version skew — the in-browser engine and backend disagree on{" "}
      {skew.mismatch.join(", ")}. Enriched decks from the backend may not load. Rebuild the matched
      pair (<code>invoke release-web</code> in srg_sim).
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-gray-100"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
