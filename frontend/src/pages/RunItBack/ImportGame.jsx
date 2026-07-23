// Run It Back — import a match archive played somewhere else.
//
// The headline use of the record format: a game played in person (or on another
// platform) is transcribed by hand into a match record (srg_sim
// schemas/v1/match_record.md — start from fixtures/records/observer_example.json)
// and uploaded here, where it becomes replayable and optionally public.
//
// There is deliberately no authoring tool: the archive is written by hand, so
// what this screen owes the author is a good validator. Two run in sequence:
//
//   1. the WASM validator in the browser (instant, structural — the same
//      `srg validate-record` check the engine ships), and
//   2. the server, which additionally resolves every card uuid against the card
//      DB and is the authoritative gate, since the record gets persisted and may
//      later be published.
//
// Errors block the import; warnings (a thin archive that still plays back —
// missing counts, an unidentified card) are advisory and can be imported past.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/apiClient";
import { ensureEngine, validateRecord } from "../../runitback/engine";

const errText = (e) => String(e?.detail ?? e?.message ?? e);

// Merge the browser's structural findings with the server's card-DB findings,
// de-duplicated (both run the same structural validator, so they overlap).
function mergeFindings(local, remote) {
  const uniq = (a, b) => [...new Set([...(a ?? []), ...(b ?? [])])];
  return {
    errors: uniq(local?.errors, remote?.errors),
    warnings: uniq(local?.warnings, remote?.warnings),
  };
}

// Parse + validate in the browser, then ask the server. Returns
// { record, findings }; a JSON syntax error comes back as a single error, since
// that is by far the most common thing to get wrong in a hand-written archive.
async function runValidation(text) {
  await ensureEngine();
  const local = validateRecord(text);
  let record = null;
  try {
    record = JSON.parse(text);
  } catch (e) {
    return { record: null, findings: { errors: [`invalid JSON: ${e.message}`], warnings: [] } };
  }
  if (local.errors.length) return { record, findings: local };
  const remote = await api.post("/api/rib/games/import/check", { record });
  return { record, findings: mergeFindings(local, remote) };
}

// A one-line summary of what the archive claims to be, so the author can see
// they pasted the game they meant to.
function describe(record) {
  if (!record) return null;
  const players = record.players ?? {};
  const seat = (s) => players[s]?.competitor?.name || players[s]?.player || `Player ${s}`;
  const r = record.result ?? {};
  const outcome = r.winner === "draw" ? "draw" : `${r.winner} wins by ${r.reason}`;
  return `${record.kind ?? "?"} record — ${seat("A")} vs ${seat("B")}, ${
    record.frames?.length ?? 0
  } frames, ${outcome} in ${r.turns} turns`;
}

export default function ImportGame() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [record, setRecord] = useState(null);
  const [findings, setFindings] = useState(null);
  const [visibility, setVisibility] = useState("private");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const busy = status === "checking" || status === "importing";
  const checked = findings !== null;
  const blocked = checked && findings.errors.length > 0;

  // Any edit invalidates the previous verdict — never let a stale "✓ valid"
  // sit above changed text.
  const edit = (value) => {
    setText(value);
    setFindings(null);
    setRecord(null);
  };

  const readFile = async (file) => {
    if (file) edit(await file.text());
  };

  const check = async () => {
    setStatus("checking");
    setError(null);
    try {
      const { record: rec, findings: f } = await runValidation(text);
      setRecord(rec);
      setFindings(f);
    } catch (e) {
      setError(errText(e));
    } finally {
      setStatus("idle");
    }
  };

  const doImport = async () => {
    setStatus("importing");
    setError(null);
    try {
      const saved = await api.post("/api/rib/games/import", { record, visibility });
      navigate(`/run-it-back/games/${saved.id}`);
    } catch (e) {
      setError(errText(e));
      setStatus("idle");
    }
  };

  return (
    <Shell>
      <p className="mb-4 text-sm text-gray-400">
        Paste a match record — an ordered sequence of observable frames describing a game
        played elsewhere. It is validated before anything is stored, and once imported it
        replays exactly like a game played here.
      </p>

      {error && (
        <div className="mb-3 rounded border border-rose-600 bg-rose-950/60 p-2 text-sm text-rose-200">{error}</div>
      )}

      <label className="mb-3 block text-sm">
        <span className="mb-1 block text-gray-400">
          Record JSON <span className="text-gray-600">— match_record schema, version 1</span>
        </span>
        <textarea
          value={text}
          rows={16}
          spellCheck={false}
          onChange={(e) => edit(e.target.value)}
          placeholder='{ "schema_version": 1, "kind": "observer", … }'
          className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 font-mono text-xs text-gray-100"
        />
      </label>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="text-gray-400">
          or load a file{" "}
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => readFile(e.target.files?.[0])}
            className="text-gray-300 file:mr-2 file:rounded file:border file:border-gray-600 file:bg-gray-800 file:px-2 file:py-1 file:text-gray-200"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={check}
          disabled={busy || !text.trim()}
          className="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-gray-100 hover:bg-gray-700 disabled:opacity-50"
        >
          {status === "checking" ? "Validating…" : "Validate"}
        </button>
        <label className="text-sm text-gray-400">
          Visibility{" "}
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-gray-100"
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
        </label>
        <button
          onClick={doImport}
          disabled={busy || !checked || blocked}
          className="rounded-md border border-srgPurple bg-srgPurple/30 px-4 py-2 font-medium text-white hover:bg-srgPurple/50 disabled:opacity-50"
          title={checked ? undefined : "Validate the record first"}
        >
          {status === "importing" ? "Importing…" : "Import game"}
        </button>
      </div>

      {checked && <Findings findings={findings} summary={describe(record)} />}
    </Shell>
  );
}

function Findings({ findings, summary }) {
  const { errors, warnings } = findings;
  const ok = errors.length === 0;
  return (
    <div className="mt-4 rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm">
      <div className={ok ? "font-semibold text-emerald-400" : "font-semibold text-rose-300"}>
        {ok ? "✓ Valid archive" : `✗ ${errors.length} error${errors.length === 1 ? "" : "s"} — nothing was stored`}
      </div>
      {ok && summary && <p className="mt-1 text-gray-300">{summary}</p>}
      <FindingList label="Errors" items={errors} tone="text-rose-300" />
      <FindingList label="Warnings" items={warnings} tone="text-amber-300" />
      {ok && warnings.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Warnings are advisory — a thinner archive still plays back. You can import anyway.
        </p>
      )}
    </div>
  );
}

// A thin archive can produce a warning per seat per frame (hundreds), which is
// noise rather than information — show enough to see the pattern and say how
// many were held back rather than silently truncating.
const SHOWN = 12;

function FindingList({ label, items, tone }) {
  if (!items.length) return null;
  const shown = items.slice(0, SHOWN);
  return (
    <div className="mt-2">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label} ({items.length})
      </div>
      <ul className={`mt-1 list-disc space-y-0.5 pl-5 ${tone}`}>
        {shown.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
      {items.length > shown.length && (
        <p className="mt-1 pl-5 text-xs text-gray-500">
          …and {items.length - shown.length} more
        </p>
      )}
    </div>
  );
}

function Shell({ children }) {
  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Import a game</h1>
        <a href="/run-it-back/games" className="text-sm text-gray-400 hover:text-srgPurple">
          ← Saved games
        </a>
      </div>
      {children}
    </div>
  );
}
