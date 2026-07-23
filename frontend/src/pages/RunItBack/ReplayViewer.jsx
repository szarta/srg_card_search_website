// Run It Back — replay viewer. Steps forward/back through a saved game.
//
// A `full` record is re-simulated in the browser: reconstructReplay re-opens the
// stored snapshot and replays the recorded decisions into the ordered Step
// sequence, which we page through (read-only). `observer` records (imported,
// task 18) carry frames instead of a snapshot and aren't handled yet.

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/apiClient";
import { ensureEngine, reconstructReplay } from "../../runitback/engine";
import Board from "./components/Board.jsx";
import DecisionPanel from "./components/DecisionPanel.jsx";

const errText = (e) => String(e?.detail ?? e?.message ?? e);
const fmt = (n) => (n > 0 ? `+${n}` : `${n}`);

// Load the engine + record and reconstruct the ordered step sequence.
// `publicMode` reads from the no-login public archive instead of the owner API.
function useReplay(recordId, publicMode) {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureEngine();
        const path = publicMode ? `/api/games/public/${recordId}` : `/api/rib/games/${recordId}`;
        const record = await api.get(path);
        if (record.information_view === "observer") {
          if (alive) setState({ status: "observer", record });
          return;
        }
        const steps = reconstructReplay(JSON.parse(record.snapshot), record.decisions || []);
        if (alive) setState({ status: "ready", steps, decisions: record.decisions || [], record });
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

export default function ReplayViewer({ publicMode = false }) {
  const { recordId } = useParams();
  const st = useReplay(recordId, publicMode);
  const [cursor, setCursor] = useState(0);

  if (st.status === "loading") return <Shell publicMode={publicMode}><p className="text-gray-400">Reconstructing game…</p></Shell>;
  if (st.status === "error") {
    return (
      <Shell publicMode={publicMode}>
        <div className="rounded border border-rose-600 bg-rose-950/60 p-3 text-sm text-rose-200">{st.error}</div>
      </Shell>
    );
  }
  if (st.status === "observer") {
    return (
      <Shell publicMode={publicMode}>
        <p className="text-gray-400">
          This is an imported (observer) game. Frame-by-frame playback for imports arrives with the
          import feature.
        </p>
      </Shell>
    );
  }

  const { steps, decisions } = st;
  const last = steps.length - 1;
  const at = Math.min(cursor, last);
  const step = steps[at];

  return (
    <Shell publicMode={publicMode}>
      <Scrubber at={at} last={last} onGo={(n) => setCursor(Math.max(0, Math.min(last, n)))} />
      <div className="mt-3">
        {step.kind === "done" ? (
          <Result result={step.result} publicMode={publicMode} />
        ) : (
          <StepView step={step} chosenIndex={decisions[at]} publicMode={publicMode} />
        )}
      </div>
    </Shell>
  );
}

function StepView({ step, chosenIndex, publicMode }) {
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
