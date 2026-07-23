// Landing page for the authed Run It Back section. Decks + Play fill in during
// P3; for now this confirms the auth loop works end to end.
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

export default function RunItBackHome() {
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Run It Back</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-400">{user?.email}</span>
          <button
            onClick={logout}
            className="rounded border border-gray-600 px-3 py-1 text-gray-200 hover:bg-srgGray"
          >
            Sign out
          </button>
        </div>
      </div>

      <p className="text-gray-400 mb-6">
        Play a game of Supershow against an AI opponent using one of your decks.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/run-it-back/decks"
          className="rounded-lg border border-gray-700 bg-srgGray p-5 hover:border-srgPurple"
        >
          <h2 className="text-lg font-semibold text-white">My Decks</h2>
          <p className="text-sm text-gray-400">Build and manage your decks.</p>
        </Link>
        <Link
          to="/run-it-back/play"
          className="rounded-lg border border-gray-700 bg-srgGray p-5 hover:border-srgPurple"
        >
          <h2 className="text-lg font-semibold text-white">Play</h2>
          <p className="text-sm text-gray-400">Pick a deck and an opponent.</p>
        </Link>
      </div>
    </div>
  );
}
