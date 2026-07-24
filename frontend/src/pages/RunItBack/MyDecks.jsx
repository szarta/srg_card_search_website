// Run It Back — the user's own deck list. Auth-gated CRUD over /api/rib/decks;
// each row links to the editor and to Play (with the deck preselected). Delete
// uses an inline confirm (no native dialog).

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/apiClient";
import { deckCardCount } from "../../runitback/deckData";

export default function MyDecks() {
  const [decks, setDecks] = useState(null);
  const [error, setError] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setError(null);
    try {
      const data = await api.get("/api/rib/decks");
      setDecks(data.decks ?? []);
    } catch (e) {
      setError(String(e?.detail ?? e?.message ?? e));
      setDecks([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    setBusyId(id);
    try {
      await api.del(`/api/rib/decks/${id}`);
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
        <h1 className="text-xl font-bold text-white">My Decks</h1>
        <Link to="/run-it-back" className="text-sm text-gray-400 hover:text-srgPurple">
          ← Run It Back
        </Link>
      </div>

      {error && (
        <div className="mb-3 rounded border border-rose-600 bg-rose-950/60 p-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      <Link
        to="/run-it-back/decks/new"
        className="mb-4 inline-block rounded-md border border-srgPurple bg-srgPurple/30 px-4 py-2 font-medium text-white hover:bg-srgPurple/50"
      >
        + New deck
      </Link>

      {decks === null ? (
        <p className="text-gray-400">Loading…</p>
      ) : decks.length === 0 ? (
        <p className="text-gray-400">
          No decks yet. Create one, or just head to{" "}
          <Link to="/run-it-back/play" className="text-srgPurple hover:underline">
            Play
          </Link>{" "}
          and use a sample deck.
        </p>
      ) : (
        <ul className="space-y-2">
          {decks.map((d) => (
            <DeckRow
              key={d.id}
              deck={d}
              confirming={confirmId === d.id}
              busy={busyId === d.id}
              onAskDelete={() => setConfirmId(d.id)}
              onCancelDelete={() => setConfirmId(null)}
              onConfirmDelete={() => remove(d.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function DeckRow({ deck, confirming, busy, onAskDelete, onCancelDelete, onConfirmDelete }) {
  const count = deckCardCount(deck.deck_data);
  const complete = count === 30;
  return (
    <li className="flex items-center justify-between rounded-lg border border-gray-700 bg-srgGray p-3">
      <div>
        <div className="font-medium text-white">{deck.name}</div>
        <div className="text-xs text-gray-400">
          {count} deck card{count === 1 ? "" : "s"}
          {!complete && <span className="ml-2 text-amber-400">draft (needs 30)</span>}
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
              to={`/run-it-back/play?your=${deck.id}`}
              className="rounded border border-gray-600 px-2 py-1 text-gray-200 hover:bg-gray-800"
            >
              Play
            </Link>
            <Link
              to={`/run-it-back/decks/${deck.id}`}
              className="rounded border border-gray-600 px-2 py-1 text-gray-200 hover:bg-gray-800"
            >
              Edit
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
