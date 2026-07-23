// A single card, rendered from the observable-state card shape
// ({ db_uuid, name, number, atk_type, play_order, ... }). Presentational only.
// A card whose parsed effects include an `Unsupported` node is flagged, since
// some of its text safely no-ops under partial rules coverage (see FRONTEND_HANDOFF).

const ATK_TONE = {
  Strike: "border-rose-500/60",
  Grapple: "border-emerald-500/60",
  Submission: "border-sky-500/60",
  None: "border-gray-600/60",
};

export function hasUnsupported(card) {
  const effects = card?.effects;
  if (!effects) return false;
  try {
    return JSON.stringify(effects).includes("Unsupported");
  } catch {
    return false;
  }
}

export default function CardChip({ card, selectable = false, selected = false, onClick }) {
  const tone = ATK_TONE[card.atk_type] ?? ATK_TONE.None;
  const partial = hasUnsupported(card);
  return (
    <div
      onClick={onClick}
      className={[
        "w-28 shrink-0 rounded-md border bg-gray-900/80 px-2 py-1.5 text-left",
        selected ? "border-amber-400 ring-1 ring-amber-400/60" : tone,
        selectable ? "cursor-pointer hover:bg-gray-800" : "",
      ].join(" ")}
      title={card.raw_text || card.name}
    >
      <div className="flex items-baseline justify-between text-[10px] text-gray-400">
        <span>#{card.number}</span>
        <span>{card.play_order}</span>
      </div>
      <div className="truncate text-sm font-medium leading-tight text-gray-100">
        {card.name}
        {partial && (
          <span title="Some of this card's text isn't modeled yet (safely no-ops)" className="ml-1 text-[10px] text-amber-400">
            ⚠
          </span>
        )}
      </div>
      <div className="text-[10px] text-gray-400">{card.atk_type}</div>
    </div>
  );
}
