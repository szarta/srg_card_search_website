import { useState } from "react";
import CardChip from "./CardChip.jsx";

// An inspectable discard pile: collapsed to a count, click to fan the cards out.
export default function DiscardStack({ cards }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-gray-800 bg-gray-900/40 p-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium text-gray-300 hover:text-gray-100"
      >
        Discard ({cards.length}) {open ? "▾" : "▸"}
      </button>
      {open && cards.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cards.map((c, i) => (
            <CardChip key={`${c.db_uuid}-${i}`} card={c} />
          ))}
        </div>
      )}
    </div>
  );
}
