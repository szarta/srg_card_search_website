// Run It Back — deck editor. Create or edit one of the user's decks.
//
// Reuses the site's card-resolution endpoints (paste names, like CreateList)
// but adds the structure a playable deck needs: one competitor, one entrance,
// and the main-deck cards, plus a spectacle type. Names resolve to uuids via the
// public batch endpoint; the assembled deck_data is checked against the engine
// (/api/decks/validate) and saved to /api/rib/decks. Drafts are allowed — the
// backend only enforces the strict 30-card rules at enrichment / game start.

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/apiClient";
import {
  COMPETITOR_TYPE,
  ENTRANCE_TYPE,
  SPECTACLE_TYPES,
  buildDeckData,
  parseNames,
  resolveNames,
  resolveUuids,
  splitDeckData,
} from "../../runitback/deckData";

const rowInfo = (r) => ({
  uuid: r.db_uuid,
  name: r.name,
  card_type: r.card_type,
  number: r.deck_card_number,
  atk: r.atk_type,
  order: r.play_order,
});
const firstRow = (res) => (res.rows[0] ? rowInfo(res.rows[0]) : null);

// Resolve the three name boxes into a structured preview of matched cards.
async function resolveDeck({ competitorText, entranceText, deckText }) {
  const [comp, ent, deck] = await Promise.all([
    resolveNames(parseNames(competitorText)),
    resolveNames(parseNames(entranceText)),
    resolveNames(parseNames(deckText)),
  ]);
  return {
    competitor: firstRow(comp),
    entrance: firstRow(ent),
    deckRows: deck.rows.map(rowInfo),
    unmatched: [...comp.unmatched, ...ent.unmatched, ...deck.unmatched],
  };
}

function previewToDeckData(spectacleType, preview) {
  return buildDeckData({
    spectacleType,
    competitorUuid: preview.competitor?.uuid || null,
    entranceUuid: preview.entrance?.uuid || null,
    deckUuids: preview.deckRows.map((r) => r.uuid),
  });
}

const errText = (e) => String(e?.detail ?? e?.message ?? e);

// Load a stored deck and turn it into editor field text (uuids -> names).
async function loadDeckFields(deckId) {
  const deck = await api.get(`/api/rib/decks/${deckId}`);
  const { spectacleType, competitorUuid, entranceUuid, deckUuids } = splitDeckData(deck.deck_data);
  const { rows } = await resolveUuids([competitorUuid, entranceUuid, ...deckUuids].filter(Boolean));
  const byUuid = new Map(rows.map((r) => [r.db_uuid, r]));
  const nameOf = (u) => byUuid.get(u)?.name ?? "";
  return {
    name: deck.name,
    spectacleType,
    competitorText: nameOf(competitorUuid),
    entranceText: nameOf(entranceUuid),
    deckText: deckUuids.map(nameOf).filter(Boolean).join("\n"),
  };
}

// Resolve the name boxes and validate the assembled deck against the engine.
async function resolveAndValidate(fields, spectacleType) {
  const preview = await resolveDeck(fields);
  const deck_data = previewToDeckData(spectacleType, preview);
  const validation = await api.post("/api/decks/validate", { deck_data });
  return { preview, validation };
}

function persistDeck(editing, deckId, name, deckData) {
  const body = { name, deck_data: deckData };
  return editing ? api.put(`/api/rib/decks/${deckId}`, body) : api.post("/api/rib/decks", body);
}

export default function DeckEditor() {
  const { deckId } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(deckId);

  const [name, setName] = useState("");
  const [spectacleType, setSpectacleType] = useState("NEWMAN");
  const [competitorText, setCompetitorText] = useState("");
  const [entranceText, setEntranceText] = useState("");
  const [deckText, setDeckText] = useState("");

  const [preview, setPreview] = useState(null);
  const [validation, setValidation] = useState(null);
  const [status, setStatus] = useState(editing ? "loading" : "idle");
  const [error, setError] = useState(null);

  const fields = () => ({ competitorText, entranceText, deckText });

  // Load an existing deck: fetch it, resolve its uuids to names, fill the boxes.
  useEffect(() => {
    if (!editing) return;
    let alive = true;
    loadDeckFields(deckId)
      .then((f) => {
        if (!alive) return;
        setName(f.name);
        setSpectacleType(f.spectacleType);
        setCompetitorText(f.competitorText);
        setEntranceText(f.entranceText);
        setDeckText(f.deckText);
        setStatus("idle");
      })
      .catch((e) => {
        if (alive) {
          setError(errText(e));
          setStatus("idle");
        }
      });
    return () => {
      alive = false;
    };
  }, [editing, deckId]);

  // Resolve names -> cards and check the assembled deck against the engine.
  const check = async () => {
    setStatus("resolving");
    setError(null);
    setValidation(null);
    try {
      const { preview: p, validation: v } = await resolveAndValidate(fields(), spectacleType);
      setPreview(p);
      setValidation(v);
    } catch (e) {
      setError(errText(e));
    } finally {
      setStatus("idle");
    }
  };

  const save = async () => {
    setStatus("saving");
    setError(null);
    try {
      const p = preview ?? (await resolveDeck(fields()));
      await persistDeck(editing, deckId, name, previewToDeckData(spectacleType, p));
      navigate("/run-it-back/decks");
    } catch (e) {
      setError(errText(e));
      setStatus("idle");
    }
  };

  if (status === "loading") {
    return <Shell title="Edit deck"><p className="text-gray-400">Loading…</p></Shell>;
  }

  const busy = status === "resolving" || status === "saving";
  return (
    <Shell title={editing ? "Edit deck" : "New deck"}>
      {error && (
        <div className="mb-3 rounded border border-rose-600 bg-rose-950/60 p-2 text-sm text-rose-200">{error}</div>
      )}

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Deck name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Bull deck"
              className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-gray-100"
            />
          </Field>
          <Field label="Spectacle type">
            <select
              value={spectacleType}
              onChange={(e) => setSpectacleType(e.target.value)}
              className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 text-gray-100"
            >
              {SPECTACLE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>

        <NameBox label="Competitor" hint="one card name" value={competitorText} onChange={setCompetitorText} rows={1} />
        <NameBox label="Entrance" hint="one card name" value={entranceText} onChange={setEntranceText} rows={1} />
        <NameBox label="Main deck" hint="one card name per line — 30 for a legal deck" value={deckText} onChange={setDeckText} rows={12} />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={check}
            disabled={busy}
            className="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-gray-100 hover:bg-gray-700 disabled:opacity-50"
          >
            {status === "resolving" ? "Checking…" : "Resolve & check"}
          </button>
          <button
            onClick={save}
            disabled={busy || !name.trim()}
            className="rounded-md border border-srgPurple bg-srgPurple/30 px-4 py-2 font-medium text-white hover:bg-srgPurple/50 disabled:opacity-50"
          >
            {status === "saving" ? "Saving…" : editing ? "Save changes" : "Create deck"}
          </button>
        </div>

        {preview && <Preview preview={preview} validation={validation} />}
      </div>
    </Shell>
  );
}

function Preview({ preview, validation }) {
  const deckCount = preview.deckRows.length;
  const compBad = preview.competitor && preview.competitor.card_type !== COMPETITOR_TYPE;
  const entBad = preview.entrance && preview.entrance.card_type !== ENTRANCE_TYPE;
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-3 text-sm">
      <div className="mb-2 font-semibold text-gray-200">Preview</div>
      <PreviewLine label="Competitor" ok={!!preview.competitor && !compBad}>
        {preview.competitor ? preview.competitor.name : "—"}
        {compBad && <Warn>not a single competitor</Warn>}
      </PreviewLine>
      <PreviewLine label="Entrance" ok={!!preview.entrance && !entBad}>
        {preview.entrance ? preview.entrance.name : "—"}
        {entBad && <Warn>not an entrance card</Warn>}
      </PreviewLine>
      <PreviewLine label="Main deck" ok={deckCount === 30}>
        {deckCount} card{deckCount === 1 ? "" : "s"}
        {deckCount !== 30 && <Warn>needs 30</Warn>}
      </PreviewLine>

      {preview.unmatched.length > 0 && (
        <p className="mt-2 text-amber-300">Unmatched names: {preview.unmatched.join(", ")}</p>
      )}

      {validation && (
        <p className={`mt-2 ${validation.valid ? "text-emerald-400" : "text-rose-300"}`}>
          {validation.valid ? "✓ Engine accepts this deck." : `✗ ${validation.detail || "Not a legal deck yet."}`}
        </p>
      )}
    </div>
  );
}

const Warn = ({ children }) => <span className="ml-2 text-xs text-amber-400">({children})</span>;

function PreviewLine({ label, ok, children }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={ok ? "text-emerald-400" : "text-gray-500"}>{ok ? "✓" : "•"}</span>
      <span className="w-24 shrink-0 text-gray-400">{label}</span>
      <span className="text-gray-100">{children}</span>
    </div>
  );
}

function Shell({ title, children }) {
  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">{title}</h1>
        <a href="/run-it-back/decks" className="text-sm text-gray-400 hover:text-srgPurple">
          ← My Decks
        </a>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function NameBox({ label, hint, value, onChange, rows }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-gray-400">
        {label} <span className="text-gray-600">— {hint}</span>
      </span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-700 bg-gray-900 px-2 py-1.5 font-mono text-gray-100"
      />
    </label>
  );
}
