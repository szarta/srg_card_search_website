// Run It Back — public games archive. Browsable and replayable by ANYONE, no
// login (this route is outside RequireAuth). Lists records marked public via
// the no-login /api/games/public endpoint; each links to the public replay.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/apiClient";

const seatName = (p, seat) => p?.[seat]?.competitor || `Player ${seat}`;

function matchupLine(rec) {
  const p = rec.participants;
  const a = seatName(p, "A");
  const b = seatName(p, "B");
  if (rec.result?.winner === "draw") return `Draw: ${a} vs ${b}`;
  const winner = rec.result?.winner === "A" ? a : b;
  const loser = rec.result?.winner === "A" ? b : a;
  return `${winner} def. ${loser}`;
}

export default function PublicGames() {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .get("/api/games/public")
      .then((d) => alive && setRecords(d.records ?? []))
      .catch((e) => alive && (setError(String(e?.detail ?? e?.message ?? e)), setRecords([])));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Public games</h1>
        <Link to="/run-it-back" className="text-sm text-gray-400 hover:text-srgPurple">
          Run It Back →
        </Link>
      </div>
      <p className="mb-4 text-sm text-gray-400">
        Games players have shared publicly. Anyone can watch — no login needed.
      </p>

      {error && (
        <div className="mb-3 rounded border border-rose-600 bg-rose-950/60 p-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {records === null ? (
        <p className="text-gray-400">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-gray-400">No public games yet.</p>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-lg border border-gray-700 bg-srgGray p-3"
            >
              <div>
                <div className="font-medium text-white">{matchupLine(r)}</div>
                <div className="text-xs text-gray-400">
                  by {r.result?.reason} · {r.result?.turns} turns
                  {r.source === "import" && (
                    <span className="ml-2 text-sky-300">{r.meta?.source || "imported"}</span>
                  )}
                </div>
              </div>
              <Link
                to={`/run-it-back/public/${r.id}`}
                className="rounded border border-gray-600 px-3 py-1 text-sm text-gray-200 hover:bg-gray-800"
              >
                Watch
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
