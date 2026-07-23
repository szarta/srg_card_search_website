// The outstanding decision: renders each legal option as a labelled button.
// Clicking submits its INDEX back through the WASM Session.
//
// Option shapes come straight from the engine's `legal` list and vary by `point`
// (schemas/v1/decision_protocol.md). Card options carry no name — only a `card`
// uuid — so we join against the card objects visible in observable_state. We
// branch on `point` first, then `kind`, per the protocol's guidance, and fall
// back to showing the raw option so nothing is ever hidden from the player.

// Build a uuid -> card-name lookup over every card visible in this projection
// (both boards' in_play + discard, plus any visible hand). `owner` on cross-board
// options just tells us whose pile a uuid is in; a global map resolves the name.
function buildCardIndex(observable_state) {
  const idx = new Map();
  const players = observable_state?.players ?? {};
  for (const seat of Object.keys(players)) {
    const p = players[seat] ?? {};
    for (const zone of [p.in_play, p.discard, p.hand]) {
      if (Array.isArray(zone)) {
        for (const c of zone) if (c?.db_uuid && !idx.has(c.db_uuid)) idx.set(c.db_uuid, c);
      }
    }
  }
  return idx;
}

const ORDER_ATK = (o) =>
  [o.atk_type, o.order].filter((x) => x && x !== "None").join(" ");

// Per-option helpers shared by the labelers below.
const nameOf = (o, cardIndex) => cardIndex.get(o.card)?.name ?? `#${o.number}`;
const ownerTag = (o) => (o.owner ? ` (${o.owner})` : "");

function optionalLabel(o) {
  if (o.kind === "yes") return o.clause ? `Yes — ${o.clause}` : "Yes";
  return o.clause && o.kind !== "no" ? `No — ${o.clause}` : "No";
}

function stopLabel(o, n) {
  if (o.kind !== "none") return `Stop with ${n}`;
  const vs = [o.vs_type, o.vs_order].filter((x) => x && x !== "None").join(" ");
  return vs ? `Don't stop (vs ${vs})` : "Don't stop";
}

// One labeler per decision `point`, each receiving (option, joinedCardName,
// ownerTag). A flat dispatch table keeps optionLabel itself trivial and makes
// the point→label mapping easy to scan against decision_protocol.md.
const POINT_LABELERS = {
  turn_action: (o, n) =>
    o.kind === "pass" ? "Pass" : `Play ${n}${ORDER_ATK(o) ? ` · ${ORDER_ATK(o)}` : ""}`,
  stop: stopLabel,
  optional: optionalLabel,
  optional_swap: optionalLabel,
  elect_bump: (o) =>
    o.kind === "yes" ? `Elect bump${o.losing ? " (you're losing the roll)" : ""}` : "Don't elect",
  choice: (o) => o.label ?? `Option ${o.index ?? ""}`,
  name: (o) => o.name ?? "(name)",
  mulligan: (o) => (o.kind === "redraw" ? "Redraw opening hand" : "Keep opening hand"),
  mulligan_draw: (o) => (o.n === 0 ? "Draw none" : `Draw ${o.n}`),
  mulligan_bury: (o, n) => `Bury ${n}`,
  target: (o, n, w) => (o.kind === "none" ? "Done / none" : `Choose ${n}${w}`),
  return_to_hand: (o, n, w) => `Return ${n} to hand${w}`,
  bury: (o, n, w) => `Bury ${n}${w}`,
  discard: (o, n) => `Discard ${n}`,
  bury_hand: (o, n) => `Discard ${n}`,
  discard_opp_hand: (o, n) => `Discard opponent's ${n}`,
  bury_opp_hand: (o, n) => `Bury opponent's ${n}`,
  reshuffle_target: (o) => `Reshuffle ${o.seat}'s discard`,
  reroll_target: (o) => `Re-roll ${o.target === "SELF" ? "your" : "opponent's"} roll`,
};

// Human-readable label for one legal option, given its decision `point`.
function optionLabel(o, point, cardIndex) {
  const n = nameOf(o, cardIndex);
  const labeler = POINT_LABELERS[point];
  if (labeler) return labeler(o, n, ownerTag(o));
  // Unknown point: prefer a card name if one is joinable, else the raw option.
  if (o.card) return `${o.kind ?? "choose"} ${n}${ownerTag(o)}`;
  return o.kind ? o.kind : JSON.stringify(o);
}

// A short human framing of what the whole decision is asking.
const POINT_PROMPT = {
  turn_action: "Play a card or pass",
  stop: "Defend the attack, or let it through",
  optional: "A “you may” effect — accept or decline",
  optional_swap: "Swap a hand card with a discard card?",
  elect_bump: "Elect the same-skill roll bump?",
  choice: "Choose one",
  name: "Name a card",
  mulligan: "Redraw your opening hand?",
  mulligan_draw: "How many cards to redraw?",
  mulligan_bury: "Place a card on the bottom of your deck",
  target: "Choose a target",
  return_to_hand: "Return an in-play card to hand",
  bury: "Bury a card to the bottom of a deck",
  discard: "Discard a card from your hand",
  discard_opp_hand: "Force an opponent's card to discard",
  bury_hand: "Bury a card from your hand",
  bury_opp_hand: "Bury a card from the opponent's hand",
  reshuffle_target: "Whose discard reshuffles into deck?",
  reroll_target: "Whose roll gets re-rolled?",
};

export default function DecisionPanel({ request, onSubmit, busy }) {
  const { viewer, point, legal, observable_state } = request;
  const cardIndex = buildCardIndex(observable_state);
  // Surface the effect's rules text once when the options don't already carry it.
  const clause = legal.find((o) => o.clause)?.clause;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
      <div className="mb-2 text-sm">
        <span className="font-semibold text-amber-300">You</span> to decide
        <span className="ml-2 text-gray-300">{POINT_PROMPT[point] ?? point}</span>
        <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-500">{point}</span>
      </div>
      {clause && point !== "optional" && point !== "optional_swap" && (
        <p className="mb-2 text-xs italic text-gray-400">{clause}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {legal.map((o, i) => (
          <button
            key={i}
            disabled={busy}
            onClick={() => onSubmit(i)}
            className="rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-gray-100 hover:border-amber-400 hover:bg-gray-700 disabled:opacity-50"
          >
            {optionLabel(o, point, cardIndex)}
          </button>
        ))}
      </div>
    </div>
  );
}
