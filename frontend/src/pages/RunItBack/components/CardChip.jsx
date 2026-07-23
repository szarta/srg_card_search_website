// A single card, rendered from the observable-state card shape
// ({ db_uuid, name, number, atk_type, play_order, ... }). Presentational only.
// A card whose parsed effects include an `Unsupported` node is flagged, since
// some of its text safely no-ops under partial rules coverage (see FRONTEND_HANDOFF).

import { useState } from "react";

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

// The site's card art, keyed by uuid (same paths as CardGrid/CardDetail). The
// chip art stays small — most of the time knowing *which* card is in play is
// enough — and hovering blows it up to a readable size instead. An unidentified
// imported card has no uuid and simply gets no art.
const THUMB = (uuid) => `/images/thumbnails/${uuid.slice(0, 2)}/${uuid}.webp`;
const FULL = (uuid) => `/images/fullsize/${uuid.slice(0, 2)}/${uuid}.webp`;
const FALLBACK_THUMB = "/images/thumbnails/im/image_unavailable.webp";

const swapToFallback = (e) => {
  if (e.currentTarget.src.endsWith(FALLBACK_THUMB)) return;
  e.currentTarget.src = FALLBACK_THUMB;
};

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
      onError={swapToFallback}
      className="mx-auto mb-1 h-[109px] w-[80px] rounded-sm object-contain"
    />
  );
}

// The hover blow-up. Centred on the chip and `pointer-events-none` so it can
// never eat the click that plays the card, and only fetched on hover (an
// in-play board would otherwise pull a dozen 450x614 images nobody looked at).
//
// `max-w-none` is load-bearing: the base stylesheet caps images at
// `max-width: 100%`, and for an absolutely-positioned child that resolves
// against the chip — without it the blow-up is clamped back to chip width.
function Zoom({ card, show }) {
  if (!card.db_uuid || !show) return null;
  return (
    <img
      src={FULL(card.db_uuid)}
      alt=""
      onError={swapToFallback}
      className="pointer-events-none absolute left-1/2 top-1/2 z-50 w-[300px] max-w-none -translate-x-1/2 -translate-y-1/2 rounded-md border border-gray-600 shadow-2xl shadow-black/80"
    />
  );
}

export default function CardChip({ card, selectable = false, selected = false, onClick }) {
  const tone = ATK_TONE[card.atk_type] ?? ATK_TONE.None;
  const partial = hasUnsupported(card);
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={[
        // Wide enough for the 80px art plus the chip's own horizontal padding.
        "relative w-24 shrink-0 rounded-md border bg-gray-900/80 px-2 py-1.5 text-left",
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
      <Zoom card={card} show={hover} />
    </div>
  );
}
