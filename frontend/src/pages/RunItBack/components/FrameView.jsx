// One observable frame, rendered as a board state plus the action that produced it.
//
// Frames are the universal replay currency (srg_sim schemas/v1/match_record.md):
// an imported archive has nothing else, and a site game's frames say what
// actually happened rather than what re-simulation would produce today. A frame
// carries card *references* ({card, name?, number?}), not whole cards, so we
// adapt them into the shape the live-play Board/CardChip already render.
//
// One semantic worth knowing while reading this: state is captured AS OF the
// action, not after it settles. A card that was just played is still resolving
// through the stop window, so it appears in `in_play` on a LATER frame — or
// never, if it got stopped.

import Board from "./Board.jsx";

// CardRef -> the card shape CardChip expects. A frame deliberately carries only
// a reference, so attack type and play order come from the card DB — `cards` is
// the uuid -> row index the viewer resolved. An importer who couldn't identify a
// card is allowed to leave `card` empty, which is why nothing here assumes a hit.
function toCard(ref, cards) {
  const row = cards?.get(ref?.card);
  return {
    db_uuid: ref?.card || "",
    name: ref?.name || row?.name || "(unidentified card)",
    number: ref?.number ?? row?.deck_card_number ?? "?",
    atk_type: row?.atk_type ?? "",
    play_order: row?.play_order ?? "",
    raw_text: row?.rules_text ?? "",
  };
}

const refName = (ref, cards) => toCard(ref, cards).name;
const cardList = (refs, cards) => (refs ?? []).map((r) => refName(r, cards)).join(", ");

// A frame's per-player view -> Board's view shape. Hands are never revealed in a
// frame; optional counts an importer didn't record show as "?".
function boardView(player, competitorName, cards) {
  const p = player ?? {};
  return {
    competitor: { name: competitorName },
    in_play: (p.in_play ?? []).map((r) => toCard(r, cards)),
    discard: (p.discard ?? []).map((r) => toCard(r, cards)),
    hand_size: p.hand_size ?? "?",
    deck_size: p.deck_size ?? "?",
    gimmick_blanked: p.gimmick_blanked ?? false,
  };
}

function rollLabel(a) {
  const mods = (a.mods ?? []).map((m) => `${m.delta >= 0 ? "+" : ""}${m.delta} ${m.src}`);
  const base = a.base != null && a.base !== a.value ? ` (base ${a.base})` : "";
  return `${a.player} rolls ${a.skill} ${a.value}${base}${mods.length ? ` — ${mods.join(", ")}` : ""}`;
}

function moveLabel(verb, a, cards) {
  const where = a.from ? ` from ${a.from}` : "";
  const named = a.cards?.length ? `: ${cardList(a.cards, cards)}` : "";
  return `${a.player} ${verb} ${a.count}${where}${named}`;
}

function playLabel(a, cards) {
  const how = [a.order, a.atk_type].filter((x) => x && x !== "None").join(" · ");
  return `${a.player} plays ${refName(a.card, cards)}${how ? ` — ${how}` : ""}`;
}

function breakoutLabel(a) {
  const rolls = (a.rolls ?? [])
    .map((r) => `${r.skill} ${r.value}${r.penalty ? ` −${r.penalty}` : ""}`)
    .join(", ");
  const verb = a.broke_out ? "breaks out" : "fails to break out";
  return `${a.defender} ${verb}${rolls ? ` (${rolls})` : ""}`;
}

// One labeler per action `type`, each receiving (action, cardIndex) — the same
// vocabulary as the game log, projected to what a spectator could see
// (match_record.md, "Action vocabulary").
const ACTION_LABELERS = {
  start: () => "Match start",
  roll: rollLabel,
  play: playLabel,
  stop: (a, cards) =>
    `${a.player} stops ${refName(a.stopped, cards)} with ${refName(a.card, cards)}` +
    (a.reason ? ` (${a.reason})` : ""),
  turn_result: (a) =>
    `${a.winner} wins the roll-off${a.tie_bumps ? ` after ${a.tie_bumps} tie bump(s)` : ""}`,
  draw: (a) => `${a.player} draws ${a.count}`,
  discard: (a, cards) => moveLabel("discards", a, cards),
  bury: (a, cards) => moveLabel("buries", a, cards),
  search: (a, cards) => moveLabel("searches", a, cards),
  finish_attempt: (a, cards) =>
    `${a.player} attempts ${refName(a.finish, cards)} — ${a.value}` +
    ` vs crowd meter ${a.crowd_meter}${a.auto_success ? " (automatic)" : ""}`,
  breakout: breakoutLabel,
  crowd_meter: (a) => `Crowd meter ${a.delta >= 0 ? "+" : ""}${a.delta} → ${a.value}`,
  effect: (a) => `${a.src}: ${a.action}${a.target ? ` → ${a.target}` : ""}`,
  note: (a) => a.text,
  result: (a) => `${a.winner === "draw" ? "Draw" : `${a.winner} wins`} by ${a.reason} in ${a.turns} turns`,
};

export function actionLabel(action, cards) {
  const labeler = ACTION_LABELERS[action?.type];
  if (labeler) return labeler(action, cards);
  // Unknown action type (a newer engine, an additive field): show it rather
  // than swallow it — the schema promises additive changes won't bump version.
  return action?.type ? `${action.type} ${JSON.stringify(action)}` : "—";
}

// Every card uuid a record's frames mention — what the viewer resolves against
// the card DB before playback so chips show attack type, play order, and text.
export function frameCardUuids(frames) {
  const uuids = new Set();
  const add = (ref) => ref?.card && uuids.add(ref.card);
  for (const frame of frames ?? []) {
    for (const player of Object.values(frame.players ?? {})) {
      (player.in_play ?? []).forEach(add);
      (player.discard ?? []).forEach(add);
    }
    const a = frame.action ?? {};
    [a.card, a.stopped, a.finish].forEach(add);
    (a.cards ?? []).forEach(add);
  }
  return [...uuids];
}

// `names` is { A, B } competitor display names (from the record's participants);
// `seatLabels` is { A, B } who-is-who labels ("You"/"Opponent", or neutral
// "Player A"/"Player B" for a spectator); `cards` is the uuid -> card-DB row
// index (optional — everything degrades to the reference's own name).
export default function FrameView({ frame, names, seatLabels, cards }) {
  const isNote = frame.action?.type === "note";
  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm text-gray-400">
        <span>turn {frame.turn_no}</span>
        <span>
          crowd meter{" "}
          <span className="font-mono text-gray-200">
            {frame.crowd_meter > 0 ? `+${frame.crowd_meter}` : frame.crowd_meter}
          </span>
        </span>
        <span>active {frame.active}</span>
      </div>

      <div
        className={[
          "rounded-lg border p-3 text-sm",
          isNote
            ? "border-gray-700 bg-gray-900 italic text-gray-400"
            : "border-amber-500/40 bg-amber-400/5 text-amber-100",
        ].join(" ")}
      >
        <span className="mr-2 text-[10px] uppercase tracking-wide text-gray-500">
          {frame.action?.type}
        </span>
        {actionLabel(frame.action, cards)}
      </div>

      <Board
        label={seatLabels.B}
        view={boardView(frame.players?.B, names.B, cards)}
        isSelf={false}
        isActive={frame.active === "B"}
      />
      <Board
        label={seatLabels.A}
        view={boardView(frame.players?.A, names.A, cards)}
        isSelf={false}
        isActive={frame.active === "A"}
      />
    </div>
  );
}
