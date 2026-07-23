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
function useReplay(recordId) {
  const [state, setState] = useState({ status: "loading" });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureEngine();
        const record = await api.get(`/api/rib/games/${recordId}`);
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
  }, [recordId]);
  return state;
}

export default function ReplayViewer() {
  const { recordId } = useParams();
  const st = useReplay(recordId);
  const [cursor, setCursor] = useState(0);

  if (st.status === "loading") return <Shell><p className="text-gray-400">Reconstructing game…</p></Shell>;
  if (st.status === "error") {
    return (
      <Shell>
        <div className="rounded border border-rose-600 bg-rose-950/60 p-3 text-sm text-rose-200">{st.error}</div>
      </Shell>
    );
  }
  if (st.status === "observer") {
    return (
      <Shell>
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
    <Shell>
      <Scrubber at={at} last={last} onGo={(n) => setCursor(Math.max(0, Math.min(last, n)))} />
      <div className="mt-3">
        {step.kind === "done" ? (
          <Result result={step.result} />
        ) : (
          <StepView step={step} chosenIndex={decisions[at]} />
        )}
      </div>
    </Shell>
  );
}

function StepView({ step, chosenIndex }) {
  const obs = step.request.observable_state;
  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm text-gray-400">
        <span>turn {obs.turn_no}</span>
        <span>crowd meter <span className="font-mono text-gray-200">{fmt(obs.crowd_meter)}</span></span>
        <span>active {obs.active}</span>
      </div>
      <Board label="Opponent" view={obs.players.B} isSelf={false} isActive={obs.active === "B"} />
      <Board label="You" view={obs.players.A} isSelf isActive={obs.active === "A"} />
      <DecisionPanel request={step.request} readOnly chosenIndex={chosenIndex} />
    </div>
  );
}

function Result({ result }) {
  const you = result.winner === "A";
  const draw = result.winner === "draw";
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-6 text-center">
      <div className={`text-2xl font-bold ${draw ? "text-gray-300" : you ? "text-emerald-400" : "text-rose-400"}`}>
        {draw ? "Draw" : you ? "You win" : "You lose"}
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

function Shell({ children }) {
  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Replay</h1>
        <Link to="/run-it-back/games" className="text-sm text-gray-400 hover:text-srgPurple">
          ← Saved games
        </Link>
      </div>
      {children}
    </div>
  );
}
