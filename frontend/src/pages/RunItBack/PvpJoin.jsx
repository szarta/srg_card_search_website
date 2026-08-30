// Join a two-player game by code. An invite link carries the match id and code
// as ?m=&code=, so following it prefills both fields; otherwise paste them by
// hand. Pick your deck, join, and go straight to the board.
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loadDeckOptions } from "../../lib/ribDecks";
import { joinMatch } from "../../lib/matchServer";
import { errText } from "../../lib/apiClient";
import { Shell, ErrorBanner, Field, Select } from "./components/PvpParts.jsx";

export default function PvpJoin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [matchId, setMatchId] = useState(params.get("m") ?? "");
  const [joinCode, setJoinCode] = useState(params.get("code") ?? "");
  const [deckOptions, setDeckOptions] = useState(null);
  const [deckId, setDeckId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    loadDeckOptions()
      .then((opts) => {
        if (!alive) return;
        setDeckOptions(opts);
        setDeckId(opts[0]?.id ?? "");
      })
      .catch((e) => alive && setError(errText(e)));
    return () => {
      alive = false;
    };
  }, []);

  const join = async () => {
    setError(null);
    setBusy(true);
    try {
      const deck = await deckOptions.find((d) => d.id === deckId).resolve();
      await joinMatch({ matchId: matchId.trim(), joinCode: joinCode.trim(), deck });
      navigate(`/run-it-back/pvp/${matchId.trim()}`);
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  };

  const ready = matchId.trim() && joinCode.trim() && deckId;

  return (
    <Shell title="Join a two-player game">
      <div className="space-y-4">
        <ErrorBanner>{error}</ErrorBanner>
        {deckOptions === null ? (
          <div className="text-gray-400">Loading decks…</div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Game ID">
                <input
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                  placeholder="from your invite"
                  className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 font-mono text-gray-100"
                />
              </Field>
              <Field label="Join code">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="from your invite"
                  className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 font-mono text-gray-100"
                />
              </Field>
              <Field label="Your deck">
                <Select
                  value={deckId}
                  onChange={setDeckId}
                  options={deckOptions.map((d) => [d.id, d.name])}
                />
              </Field>
            </div>
            <button
              onClick={join}
              disabled={busy || !ready}
              className="rounded-md border border-srgPurple bg-srgPurple/30 px-4 py-2 font-medium text-white hover:bg-srgPurple/50 disabled:opacity-50"
            >
              {busy ? "Joining…" : "Join game"}
            </button>
          </>
        )}
      </div>
    </Shell>
  );
}
