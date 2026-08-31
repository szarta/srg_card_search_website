// Create a new two-player game: pick your deck, a seed, and visibility, then the
// match-server opens a pending match and hands back a join code. We navigate to
// the play screen carrying the code so you can copy the invite while you wait for
// your opponent to join.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadDeckOptions } from "../../lib/ribDecks";
import { createMatch } from "../../lib/matchServer";
import { errText } from "../../lib/apiClient";
import { Shell, ErrorBanner, Field, Select } from "./components/PvpParts.jsx";

export default function PvpNew() {
  const navigate = useNavigate();
  const [deckOptions, setDeckOptions] = useState(null);
  const [deckId, setDeckId] = useState("");
  const [seed, setSeed] = useState("7");
  const [visibility, setVisibility] = useState("private");
  const [turnLimit, setTurnLimit] = useState("0"); // seconds; "0" = untimed
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

  const create = async () => {
    setError(null);
    setBusy(true);
    try {
      const deck = await deckOptions.find((d) => d.id === deckId).resolve();
      const seedNum = Number.parseInt(seed, 10);
      const secs = Number.parseInt(turnLimit, 10);
      const { match_id, join_code } = await createMatch({
        deck,
        seed: Number.isFinite(seedNum) ? seedNum : 0,
        visibility,
        turnSeconds: Number.isFinite(secs) && secs > 0 ? secs : null,
      });
      navigate(`/run-it-back/pvp/${match_id}?code=${encodeURIComponent(join_code)}`);
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  };

  return (
    <Shell title="New two-player game">
      <div className="space-y-4">
        <ErrorBanner>{error}</ErrorBanner>
        {deckOptions === null ? (
          <div className="text-gray-400">Loading decks…</div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your deck">
                <Select
                  value={deckId}
                  onChange={setDeckId}
                  options={deckOptions.map((d) => [d.id, d.name])}
                />
              </Field>
              <Field label="Visibility">
                <Select
                  value={visibility}
                  onChange={setVisibility}
                  options={[
                    ["private", "Private (invite only)"],
                    ["public", "Public (listed for spectators)"],
                  ]}
                />
              </Field>
              <Field label="Turn timer">
                <Select
                  value={turnLimit}
                  onChange={setTurnLimit}
                  options={[
                    ["0", "No limit"],
                    ["259200", "3 days per turn"],
                    ["86400", "1 day per turn"],
                    ["28800", "8 hours per turn"],
                    ["3600", "1 hour per turn"],
                  ]}
                />
              </Field>
              <Field label="Seed">
                <input
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-gray-100"
                />
              </Field>
            </div>
            <button
              onClick={create}
              disabled={busy || !deckId}
              className="rounded-md border border-srgPurple bg-srgPurple/30 px-4 py-2 font-medium text-white hover:bg-srgPurple/50 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create game"}
            </button>
          </>
        )}
      </div>
    </Shell>
  );
}
