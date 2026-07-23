import CardChip from "./CardChip.jsx";
import DiscardStack from "./DiscardStack.jsx";

// One player's half of the mat, rendered from an observable player-view. The
// viewer's own hand is face-up; an opponent's is a hidden count (unless a Peek
// revealed it, in which case the engine already put the cards in `hand`).
export default function Board({ label, view, isSelf, isActive }) {
  const comp = view.competitor;
  const hand = view.hand; // array when visible, else undefined (hand_size given)
  return (
    <section
      className={[
        "rounded-lg border p-3",
        isActive ? "border-amber-400/70 bg-amber-400/5" : "border-gray-800 bg-gray-900/40",
      ].join(" ")}
    >
      <header className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-wide text-gray-500">{label}</span>{" "}
          <span className="font-semibold text-gray-100">{comp.name}</span>
          {comp.division && <span className="ml-2 text-xs text-gray-400">{comp.division}</span>}
          {view.gimmick_blanked && (
            <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300">
              gimmick blanked
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">deck {view.deck_size}</span>
      </header>

      <div className="mb-2">
        <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">In play</div>
        <InPlayLanes cards={view.in_play} />
      </div>

      <Row label={isSelf ? "Hand" : "Hand (hidden)"}>
        {hand ? (
          hand.length ? (
            hand.map((c, i) => <CardChip key={`${c.db_uuid}-${i}`} card={c} />)
          ) : (
            <Empty />
          )
        ) : (
          <span className="text-sm text-gray-500">{view.hand_size} cards</span>
        )}
      </Row>

      <div className="mt-2">
        <DiscardStack cards={view.discard} />
      </div>
    </section>
  );
}

// The in-play chain reads as three lanes — Lead, Follow Up, Finish — with each
// lane stacking downwards, which is how the cards sit on a real table. Anything
// whose play order we couldn't determine (an imported archive whose card uuid
// didn't resolve) gets its own trailing lane rather than being dropped.
const LANES = [
  ["Lead", "Lead"],
  ["Follow Up", "Followup"],
  ["Finish", "Finish"],
];

function InPlayLanes({ cards }) {
  if (!cards.length) return <Empty />;
  const lanes = LANES.map(([label, order]) => [
    label,
    cards.filter((c) => c.play_order === order),
  ]);
  const known = new Set(LANES.map(([, order]) => order));
  const rest = cards.filter((c) => !known.has(c.play_order));
  if (rest.length) lanes.push(["Other", rest]);

  return (
    <div className="flex flex-wrap gap-3">
      {lanes.map(([label, laneCards]) => (
        <div key={label} className="min-w-24">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-600">{label}</div>
          <div className="flex flex-col gap-1.5">
            {laneCards.length ? (
              laneCards.map((c, i) => <CardChip key={`${c.db_uuid}-${i}`} card={c} />)
            ) : (
              <Empty />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="mb-2">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Empty() {
  return <span className="text-sm text-gray-600">—</span>;
}
