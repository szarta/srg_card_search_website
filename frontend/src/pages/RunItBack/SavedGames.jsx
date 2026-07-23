// Run It Back — the user's saved games. Lists /api/rib/games (summaries) with an
// inline-confirm delete. Stepping through a saved game (replay) is a separate
// screen (task 17); this is the management list.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/apiClient";

const seatName = (p, seat) => p?.[seat]?.competitor || (seat === "A" ? "You" : "Opponent");

// "The Bull def. Fae Dragon" (or "Draw: … vs …").
function matchupLine(rec) {
  const p = rec.participants;
  const a = seatName(p, "A");
  const b = seatName(p, "B");
  if (rec.result?.winner === "draw") return `Draw: ${a} vs ${b}`;
  const winner = rec.result?.winner === "A" ? a : b;
  const loser = rec.result?.winner === "A" ? b : a;
  return `${winner} def. ${loser}`;
}

export default function SavedGames() {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setError(null);
    try {
      const data = await api.get("/api/rib/games");
      setRecords(data.records ?? []);
    } catch (e) {
      setError(String(e?.detail ?? e?.message ?? e));
      setRecords([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    setBusyId(id);
    try {
      await api.del(`/api/rib/games/${id}`);
      setConfirmId(null);
      await load();
    } catch (e) {
      setError(String(e?.detail ?? e?.message ?? e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Saved games</h1>
        <Link to="/run-it-back" className="text-sm text-gray-400 hover:text-srgPurple">
          ← Run It Back
        </Link>
      </div>

      {error && (
        <div className="mb-3 rounded border border-rose-600 bg-rose-950/60 p-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {records === null ? (
        <p className="text-gray-400">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-gray-400">
          No saved games yet. Finish a match in{" "}
          <Link to="/run-it-back/play" className="text-srgPurple hover:underline">
            Play
          </Link>{" "}
          and choose “Save this game”.
        </p>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <GameRow
              key={r.id}
              record={r}
              confirming={confirmId === r.id}
              busy={busyId === r.id}
              onAskDelete={() => setConfirmId(r.id)}
              onCancelDelete={() => setConfirmId(null)}
              onConfirmDelete={() => remove(r.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function GameRow({ record, confirming, busy, onAskDelete, onCancelDelete, onConfirmDelete }) {
  const { result, information_view: view } = record;
  return (
    <li className="flex items-center justify-between rounded-lg border border-gray-700 bg-srgGray p-3">
      <div>
        <div className="font-medium text-white">{matchupLine(record)}</div>
        <div className="text-xs text-gray-400">
          by {result?.reason} · {result?.turns} turns
          {view === "observer" && <span className="ml-2 text-sky-300">observer</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm">
        {confirming ? (
          <>
            <span className="text-gray-300">Delete?</span>
            <button
              onClick={onConfirmDelete}
              disabled={busy}
              className="rounded border border-rose-600 px-2 py-1 text-rose-200 hover:bg-rose-950/60 disabled:opacity-50"
            >
              {busy ? "…" : "Yes"}
            </button>
            <button onClick={onCancelDelete} className="rounded border border-gray-600 px-2 py-1 text-gray-300 hover:bg-gray-800">
              No
            </button>
          </>
        ) : (
          <>
            <Link
              to={`/run-it-back/games/${record.id}`}
              className="rounded border border-gray-600 px-2 py-1 text-gray-200 hover:bg-gray-800"
            >
              Replay
            </Link>
            <button
              onClick={onAskDelete}
              className="rounded border border-gray-700 px-2 py-1 text-gray-400 hover:bg-gray-800"
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}
