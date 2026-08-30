// Run It Back — the two-player (PvP) board.
//
// Unlike solo-vs-AI (which runs the whole match in-browser via WASM), a PvP game
// is refereed by the Rust match-server: we hold no hidden state, we ask the
// server for *this seat's* view and submit *this seat's* decisions. So the loop
// is network-shaped — poll `state` while it isn't our turn, render the board and
// options when it is, submit, and hand back. The server projects observable_state
// per seat, so the opponent's hidden cards never reach us.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { fetchState, submitDecision } from "../../lib/matchServer";
import { errText } from "../../lib/apiClient";
import Board from "./components/Board.jsx";
import DecisionPanel from "./components/DecisionPanel.jsx";

const POLL_MS = 3000;
const fmt = (n) => (n > 0 ? `+${n}` : `${n}`);

export default function PvpPlay() {
  const { matchId } = useParams();
  const [params] = useSearchParams();
  const inviteCode = params.get("code"); // present right after you create the game
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await fetchState(matchId);
      setState(s);
      setError(null);
    } catch (e) {
      setError(errText(e));
    }
  }, [matchId]);

  // Initial fetch.
  useEffect(() => {
    load();
  }, [load]);

  // Poll only while we're waiting on the other seat (pending, or opponent to
  // move). Once it's our decision or the game is over, stop hitting the server.
  const shouldPoll = state && !state.your_turn && !state.finished;
  useEffect(() => {
    if (!shouldPoll) return undefined;
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [shouldPoll, load]);

  const submit = async (i) => {
    setBusy(true);
    try {
      const s = await submitDecision(matchId, state.decision.request_id, i);
      setState(s);
      setError(null);
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Two-player game</h1>
        <Link to="/run-it-back/pvp" className="text-sm text-gray-400 hover:text-srgPurple">
          ← Two-player games
        </Link>
      </div>

      {error && (
        <div className="mb-3 rounded border border-rose-600 bg-rose-950/60 p-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {!state && !error && <div className="text-gray-400">Loading…</div>}

      {state && <Body state={state} inviteCode={inviteCode} onSubmit={submit} busy={busy} />}
    </div>
  );
}

function Body({ state, inviteCode, onSubmit, busy }) {
  if (state.finished && state.result) {
    return <Result result={state.result} seat={state.seat} />;
  }
  if (state.status === "pending") {
    return <WaitingForOpponent matchId={state.match_id} inviteCode={inviteCode} />;
  }
  if (state.your_turn && state.decision) {
    return <YourTurn state={state} onSubmit={onSubmit} busy={busy} />;
  }
  return <OpponentTurn whoseTurn={state.whose_turn} seat={state.seat} />;
}

// Seat A, no opponent yet: show what to share. The invite link prefills the join
// screen; the code alone works too if they'd rather paste it.
function WaitingForOpponent({ matchId, inviteCode }) {
  const link =
    inviteCode &&
    `${window.location.origin}/run-it-back/pvp/join?m=${encodeURIComponent(matchId)}&code=${encodeURIComponent(inviteCode)}`;
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-6">
      <div className="text-lg font-semibold text-white">Waiting for your opponent…</div>
      <p className="mt-1 text-sm text-gray-400">
        Send them this to join. This page picks up automatically once they're in.
      </p>
      {inviteCode ? (
        <div className="mt-4 space-y-3">
          <Copyable label="Invite link" value={link} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Copyable label="Game ID" value={matchId} mono />
            <Copyable label="Join code" value={inviteCode} mono />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">
          Game ID <span className="font-mono text-gray-300">{matchId}</span>. If you
          need the join code again, start a fresh game.
        </p>
      )}
    </div>
  );
}

function Copyable({ label, value, mono }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the value is visible to select by hand */
    }
  };
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="flex items-center gap-2">
        <code
          className={`flex-1 overflow-x-auto rounded border border-gray-700 bg-gray-950 px-2 py-1.5 text-sm text-gray-200 ${mono ? "font-mono" : ""}`}
        >
          {value}
        </code>
        <button
          onClick={copy}
          className="shrink-0 rounded border border-gray-600 px-2 py-1.5 text-xs text-gray-200 hover:bg-gray-800"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function OpponentTurn({ whoseTurn, seat }) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-6 text-center">
      <div className="text-lg font-semibold text-gray-200">Opponent is deciding…</div>
      <p className="mt-1 text-sm text-gray-500">
        You're seat {seat}. It's seat {whoseTurn ?? "?"}'s move — this page updates when
        it's your turn.
      </p>
    </div>
  );
}

function YourTurn({ state, onSubmit, busy }) {
  const req = state.decision;
  const obs = req.observable_state;
  const you = state.seat;
  const opp = you === "A" ? "B" : "A";
  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm text-gray-400">
        <span>turn {obs.turn_no}</span>
        <span>
          crowd meter <span className="font-mono text-gray-200">{fmt(obs.crowd_meter)}</span>
        </span>
        <span>active {obs.active}</span>
      </div>
      <Board label="Opponent" view={obs.players[opp]} isSelf={false} isActive={obs.active === opp} />
      <Board label="You" view={obs.players[you]} isSelf isActive={obs.active === you} />
      <DecisionPanel request={req} onSubmit={onSubmit} busy={busy} />
    </div>
  );
}

function Result({ result, seat }) {
  const you = result.winner === seat;
  const draw = result.winner === "draw";
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-6 text-center">
      <div
        className={`text-2xl font-bold ${draw ? "text-gray-300" : you ? "text-emerald-400" : "text-rose-400"}`}
      >
        {draw ? "Draw" : you ? "You win" : "You lose"}
      </div>
      <div className="mt-1 text-gray-400">
        by {result.reason} in {result.turns} turns
      </div>
      <div className="mt-4">
        <Link
          to="/run-it-back/pvp"
          className="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-100 hover:bg-gray-700"
        >
          Back to games
        </Link>
      </div>
    </div>
  );
}
