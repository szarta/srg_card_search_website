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

// The site's card art, keyed by uuid (same paths as CardGrid/CardDetail). Shown
// at ~40% of the thumbnail's natural 147x200 so a whole board still fits on
// screen; an unidentified imported card has no uuid and simply gets no art.
const THUMB = (uuid) => `/images/thumbnails/${uuid.slice(0, 2)}/${uuid}.webp`;
const FALLBACK_THUMB = "/images/thumbnails/im/image_unavailable.webp";

// The art box is a fixed size rather than `w-auto`: an image with no intrinsic
// size yet measures 0 wide, and a zero-area element never enters the viewport,
// so lazy loading would wait forever. It also keeps every chip the same size
// when source thumbnails differ by a few pixels.
function Art({ card }) {
  if (!card.db_uuid) return null;
  return (
    <img
      src={THUMB(card.db_uuid)}
      alt=""
      loading="lazy"
      onError={(e) => {
        if (e.currentTarget.src.endsWith(FALLBACK_THUMB)) return;
        e.currentTarget.src = FALLBACK_THUMB;
      }}
      className="mx-auto mb-1 h-20 w-[60px] rounded-sm object-contain"
    />
  );
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
      <Art card={card} />
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
