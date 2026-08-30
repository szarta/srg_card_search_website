// Run It Back — two-player (PvP) games hub.
//
// A read of the caller's matches from FastAPI (which keeps status/whose-turn
// current off the shared table the match-server writes), plus the two entry
// points: start a new game, or join one by code. Unlike solo-vs-AI play, a PvP
// game is correspondence-style — it persists between sessions, so this list is
// how you get back into a game in progress.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, errText } from "../../lib/apiClient";

const STATUS_LABEL = {
  pending: "Waiting for opponent",
  active: "In progress",
  finished: "Finished",
};

export default function PvpGames() {
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .get("/api/rib/matches")
      .then((r) => {
        if (alive) setMatches(r.matches ?? []);
      })
      .catch((e) => {
        if (alive) setError(errText(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Two-player games</h1>
        <Link to="/run-it-back" className="text-sm text-gray-400 hover:text-srgPurple">
          ← Run It Back
        </Link>
      </div>

      <p className="mb-4 text-sm text-gray-400">
        Play a real person, correspondence-style — take your turn whenever you
        like; the game waits for you both.
      </p>

      <div className="mb-6 flex gap-3">
        <Link
          to="/run-it-back/pvp/new"
          className="rounded-md border border-srgPurple bg-srgPurple/30 px-4 py-2 font-medium text-white hover:bg-srgPurple/50"
        >
          New game
        </Link>
        <Link
          to="/run-it-back/pvp/join"
          className="rounded-md border border-gray-600 px-4 py-2 font-medium text-gray-100 hover:bg-gray-800"
        >
          Join by code
        </Link>
      </div>

      {error && (
        <div className="rounded border border-rose-600 bg-rose-950/60 p-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {matches === null && !error ? (
        <div className="text-gray-400">Loading…</div>
      ) : matches && matches.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-6 text-center text-gray-400">
          No two-player games yet. Start one and share the code.
        </div>
      ) : (
        <ul className="space-y-2">
          {matches?.map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MatchRow({ match }) {
  const opponent = match.opponent_email ?? (match.status === "pending" ? "—" : "opponent");
  return (
    <li>
      <Link
        to={`/run-it-back/pvp/${match.id}`}
        className="flex items-center justify-between rounded-lg border border-gray-700 bg-srgGray p-3 hover:border-srgPurple"
      >
        <div>
          <div className="text-gray-100">
            vs {opponent}
            <span className="ml-2 text-xs text-gray-500">seat {match.your_seat}</span>
          </div>
          <div className="text-xs text-gray-500">{STATUS_LABEL[match.status] ?? match.status}</div>
        </div>
        {match.your_turn && (
          <span className="rounded bg-amber-400/20 px-2 py-0.5 text-xs text-amber-300">
            Your turn
          </span>
        )}
      </Link>
    </li>
  );
}
