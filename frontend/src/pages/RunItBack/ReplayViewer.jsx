// Run It Back — replay viewer. Steps forward/back through a saved game.
//
// Two playback modes, picked by what the record actually carries:
//
// - FRAMES (imported archives). The record stores an ordered observable-frame
//   sequence (srg_sim schemas/v1/match_record.md). No engine involved — this is
//   the only mode an imported match can use, since an observed game has no seed
//   and is not re-simulatable.
// - RE-SIMULATION (site games). The record stores the engine snapshot plus the
//   ordered human decisions; reconstructReplay re-opens and replays them into
//   the ordered Step sequence, which additionally shows the legal options at
//   each decision and highlights the move that was played.
//
// Frames win when present: they say what actually happened, whereas
// re-simulation says what today's engine would produce.

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/apiClient";
import { ensureEngine, reconstructReplay } from "../../runitback/engine";
import { resolveUuids } from "../../runitback/deckData";
import Board from "./components/Board.jsx";
import DecisionPanel from "./components/DecisionPanel.jsx";
import FrameView, { frameCardUuids } from "./components/FrameView.jsx";

const errText = (e) => String(e?.detail ?? e?.message ?? e);
const fmt = (n) => (n > 0 ? `+${n}` : `${n}`);

// Frames carry card *references*; attack type, play order, and rules text live
// in the card DB, which is public — so this works for a logged-out spectator
// too. A failure here is cosmetic (chips fall back to the reference's own name),
// so it must never take the replay down with it.
async function frameCardIndex(frames) {
  try {
    const { rows } = await resolveUuids(frameCardUuids(frames));
    return new Map(rows.map((r) => [r.db_uuid, r]));
  } catch {
    return new Map();
  }
}

// Load the record and turn it into a pageable sequence.
// `publicMode` reads from the no-login public archive instead of the owner API.
function useReplay(recordId, publicMode) {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const path = publicMode ? `/api/games/public/${recordId}` : `/api/rib/games/${recordId}`;
        const record = await api.get(path);
        if (record.frames?.length) {
          const cards = await frameCardIndex(record.frames);
          if (alive) setState({ status: "frames", frames: record.frames, record, cards });
          return;
        }
        if (!record.snapshot) {
          throw new Error("This game has no frames and no snapshot — nothing to replay.");
        }
        await ensureEngine();
        const steps = reconstructReplay(JSON.parse(record.snapshot), record.decisions || []);
        if (alive) setState({ status: "steps", steps, decisions: record.decisions || [], record });
      } catch (e) {
        if (alive) setState({ status: "error", error: errText(e) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [recordId, publicMode]);
  return state;
}

// Who-is-who labels. The owner of a site game is seat A; a spectator (and any
// imported game, where neither seat is "you") gets neutral seat labels.
function seatLabels(publicMode, record) {
  if (publicMode || record?.source === "import") return { A: "Player A", B: "Player B" };
  return { A: "You", B: "Opponent" };
}

export default function ReplayViewer({ publicMode = false }) {
  const { recordId } = useParams();
  const st = useReplay(recordId, publicMode);
  const [cursor, setCursor] = useState(0);

  if (st.status === "loading") {
    return (
      <Shell publicMode={publicMode}>
        <p className="text-gray-400">Loading game…</p>
      </Shell>
    );
  }
  if (st.status === "error") {
    return (
      <Shell publicMode={publicMode}>
        <div className="rounded border border-rose-600 bg-rose-950/60 p-3 text-sm text-rose-200">{st.error}</div>
      </Shell>
    );
  }

  const seq = st.status === "frames" ? st.frames : st.steps;
  const last = seq.length - 1;
  const at = Math.min(cursor, last);

  return (
    <Shell publicMode={publicMode}>
      <Provenance record={st.record} />
      <Scrubber at={at} last={last} onGo={(n) => setCursor(Math.max(0, Math.min(last, n)))} />
      <div className="mt-3">
        {st.status === "frames" ? (
          <FrameView
            frame={seq[at]}
            frames={seq}
            at={at}
            participants={st.record.participants}
            seatLabels={seatLabels(publicMode, st.record)}
            cards={st.cards}
          />
        ) : (
          <StepPane step={seq[at]} chosenIndex={st.decisions[at]} publicMode={publicMode} />
        )}
      </div>
    </Shell>
  );
}

// Where an imported match came from — the archive's own `meta` block.
function Provenance({ record }) {
  const meta = record?.meta;
  if (record?.source !== "import" || !meta) return null;
  return (
    <div className="mb-3 rounded-lg border border-gray-800 bg-gray-900/60 p-3 text-sm">
      <span className="mr-2 rounded bg-srgPurple/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-srgPurple">
        imported
      </span>
      <span className="text-gray-300">{meta.source || "archive"}</span>
      {meta.created && <span className="ml-2 text-xs text-gray-500">{meta.created}</span>}
      {meta.notes && <p className="mt-1 text-xs italic text-gray-400">{meta.notes}</p>}
    </div>
  );
}

function StepPane({ step, chosenIndex, publicMode }) {
  if (step.kind === "done") return <Result result={step.result} publicMode={publicMode} />;
  const obs = step.request.observable_state;
  // Steps are seat A's projection. The owner sees "You/Opponent"; a public
  // spectator gets neutral seat labels.
  const labelA = publicMode ? "Player A" : "You";
  const labelB = publicMode ? "Player B" : "Opponent";
  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm text-gray-400">
        <span>turn {obs.turn_no}</span>
        <span>crowd meter <span className="font-mono text-gray-200">{fmt(obs.crowd_meter)}</span></span>
        <span>active {obs.active}</span>
      </div>
      <Board label={labelB} view={obs.players.B} isSelf={false} isActive={obs.active === "B"} />
      <Board label={labelA} view={obs.players.A} isSelf isActive={obs.active === "A"} />
      <DecisionPanel request={step.request} readOnly chosenIndex={chosenIndex} />
    </div>
  );
}

function Result({ result, publicMode }) {
  const aWon = result.winner === "A";
  const draw = result.winner === "draw";
  let headline;
  if (draw) headline = "Draw";
  else if (publicMode) headline = `Player ${result.winner} wins`;
  else headline = aWon ? "You win" : "You lose";
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-6 text-center">
      <div className={`text-2xl font-bold ${draw ? "text-gray-300" : aWon ? "text-emerald-400" : "text-rose-400"}`}>
        {headline}
      </div>
      <div className="mt-1 text-gray-400">by {result.reason} in {result.turns} turns</div>
    </div>
  );
}

function Scrubber({ at, last, onGo }) {
  const btn = "rounded border border-gray-600 px-3 py-1 text-gray-200 hover:bg-gray-800 disabled:opacity-40";
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex gap-2">
        <button className={btn} onClick={() => onGo(0)} disabled={at === 0}>⏮ First</button>
        <button className={btn} onClick={() => onGo(at - 1)} disabled={at === 0}>‹ Prev</button>
        <button className={btn} onClick={() => onGo(at + 1)} disabled={at === last}>Next ›</button>
        <button className={btn} onClick={() => onGo(last)} disabled={at === last}>Last ⏭</button>
      </div>
      <span className="text-gray-400">
        step {at + 1} / {last + 1}
      </span>
    </div>
  );
}

function Shell({ children, publicMode }) {
  const backTo = publicMode ? "/run-it-back/public" : "/run-it-back/games";
  const backLabel = publicMode ? "← Public games" : "← Saved games";
  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Replay</h1>
        <Link to={backTo} className="text-sm text-gray-400 hover:text-srgPurple">
          {backLabel}
        </Link>
      </div>
      {children}
    </div>
  );
}
