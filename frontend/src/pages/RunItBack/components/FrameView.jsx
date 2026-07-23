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
//
// A frame carries only the two open zones — who is playing never repeats — so
// the competitor and entrance come from the record's `participants` instead.
// An archive that named them but couldn't identify them has a name and no uuid,
// which renders as text with no art.
function boardView(player, seatInfo, cards) {
  const p = player ?? {};
  return {
    competitor: { name: seatInfo.competitor, db_uuid: seatInfo.competitor_uuid },
    entrance: seatInfo.entrance && {
      name: seatInfo.entrance,
      db_uuid: seatInfo.entrance_uuid,
    },
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

// The roll-off as it stands at `at`, as an ordered list of *exchanges*.
//
// A turn is not always one roll each: a tie triggers a bump, and both seats roll
// again (`tie_bumps` counts how many times). Collapsing to "the last roll per
// seat" would hide that, so rolls are grouped — a seat rolling a second time
// starts a new exchange. The last exchange is the one that decided the turn.
//
// This is scanned rather than carried on the frame because the roll-off spans
// several frames (A rolls, B rolls, result) and a viewer sitting on any one of
// them should still see the whole exchange.
export function rollOff(frames, at) {
  const out = { exchanges: [], winner: null, tieBumps: 0 };
  if (!frames?.[at]) return out;
  const turn = frames[at].turn_no;
  let current = {};
  for (let i = 0; i <= at; i++) {
    const f = frames[i];
    if (f.turn_no !== turn) continue;
    const a = f.action ?? {};
    if (a.type === "roll") {
      if (current[a.player]) {
        out.exchanges.push(current);
        current = {};
      }
      current[a.player] = a;
    }
    if (a.type === "turn_result") {
      out.winner = a.winner;
      out.tieBumps = a.tie_bumps ?? 0;
    }
  }
  if (Object.keys(current).length) out.exchanges.push(current);
  return out;
}

// Did the seat that took the turn have the highest logged number?
//
// Often it won't, and that is not a bug in either engine or viewer: a `roll`
// frame records the roll AS MADE, while boosts, skill switches and re-rolls land
// afterwards, and a standing effect can make the LOWEST roll win. So the winner
// always comes from `turn_result` — never from comparing these values — and a
// mismatch just earns a note explaining that the numbers aren't the whole story.
function isHighest(exchange, seat) {
  const mine = exchange[seat].value;
  return Object.values(exchange).every((r) => r.value <= mine);
}

const modText = (mods) =>
  (mods ?? []).map((m) => `${m.delta >= 0 ? "+" : ""}${m.delta} ${m.src}`).join(", ");

// The turn's roll-off, given its own panel: this is the beat every turn hinges
// on, and reading it off one line of action text buried it. The deciding
// exchange is shown large; any bumped exchanges before it are listed above so a
// tie-then-bump reads as the sequence it was.
//
// The winner is whatever `turn_result` said — never inferred from the numbers.
// Some competitors and effects make the LOWEST roll take the turn, and a frame
// does not carry which comparison applied.
export function RollOff({ frames, at, names, seatLabels }) {
  const { exchanges, winner, tieBumps } = rollOff(frames, at);
  if (!exchanges.length) return null;
  const deciding = exchanges[exchanges.length - 1];
  const earlier = exchanges.slice(0, -1);
  const upset = winner && deciding[winner] && !isHighest(deciding, winner);
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/70 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">Roll-off</span>
        {winner && (
          <span className="text-xs text-emerald-300">
            {/* "won", not "takes" — the label may be "You", and "You takes" reads badly. */}
            {seatLabels[winner]} won the roll-off
            {tieBumps ? ` (after ${tieBumps} tie bump${tieBumps === 1 ? "" : "s"})` : ""}
          </span>
        )}
      </div>

      {upset && (
        <div
          className="mb-2 text-xs text-amber-300/90"
          title="A roll is recorded as it was made. Boosts, skill switches and re-rolls applied afterwards — and gimmicks that make the lowest roll win — are not in the frame, so the numbers shown are not always the ones compared."
        >
          decided against the numbers shown — see tooltip
        </div>
      )}

      {earlier.map((ex, i) => (
        <BumpedExchange key={i} exchange={ex} seatLabels={seatLabels} />
      ))}

      <div className="grid gap-2 sm:grid-cols-2">
        {["A", "B"]
          .filter((s) => deciding[s])
          .map((seat) => (
            <RollLine
              key={seat}
              roll={deciding[seat]}
              label={`${seatLabels[seat]} · ${names[seat]}`}
              won={winner === seat}
              decided={Boolean(winner)}
            />
          ))}
      </div>
    </div>
  );
}

// A tied exchange that got bumped away — one compact line, not a headline.
function BumpedExchange({ exchange, seatLabels }) {
  const part = (seat) =>
    exchange[seat] && `${seatLabels[seat]} ${exchange[seat].skill} ${exchange[seat].value}`;
  return (
    <div className="mb-1.5 text-xs text-gray-500">
      {["A", "B"].map(part).filter(Boolean).join("  vs  ")}
      <span className="ml-2 text-gray-600">— bumped</span>
    </div>
  );
}

function RollLine({ roll, label, won, decided }) {
  const mods = modText(roll.mods);
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-md border px-3 py-2",
        won ? "border-emerald-500/60 bg-emerald-500/10" : "border-gray-800 bg-gray-900",
        decided && !won ? "opacity-60" : "",
      ].join(" ")}
    >
      <span className={`font-mono text-3xl leading-none ${won ? "text-emerald-300" : "text-gray-200"}`}>
        {roll.value}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm text-gray-200">{roll.skill}</div>
        <div className="truncate text-[11px] text-gray-500">
          {label}
          {roll.base != null && roll.base !== roll.value && ` · base ${roll.base}`}
        </div>
        {mods && <div className="truncate text-[11px] text-amber-300/80" title={mods}>{mods}</div>}
      </div>
    </div>
  );
}

// `names` is { A, B } competitor display names (from the record's participants);
// `seatLabels` is { A, B } who-is-who labels ("You"/"Opponent", or neutral
// "Player A"/"Player B" for a spectator); `cards` is the uuid -> card-DB row
// index (optional — everything degrades to the reference's own name).
// `frames`/`at` are the whole sequence and this frame's index, which the
// roll-off panel needs to look back across the turn.
export default function FrameView({ frame, frames, at, participants, seatLabels, cards }) {
  const isNote = frame.action?.type === "note";
  const seat = (s) => participants?.[s] ?? {};
  const names = {
    A: seat("A").competitor || "Player A",
    B: seat("B").competitor || "Player B",
  };
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

      <RollOff frames={frames} at={at} names={names} seatLabels={seatLabels} />

      <Board
        label={seatLabels.B}
        view={boardView(frame.players?.B, { ...seat("B"), competitor: names.B }, cards)}
        isSelf={false}
        isActive={frame.active === "B"}
      />
      <Board
        label={seatLabels.A}
        view={boardView(frame.players?.A, { ...seat("A"), competitor: names.A }, cards)}
        isSelf={false}
        isActive={frame.active === "A"}
      />
    </div>
  );
}
