import { useEffect, useState } from "react";

export default function CardImage({ name }) {
  const [card, setCard] = useState(null);
  const FALLBACK_FULL = "/images/fullsize/im/image_unavailable.webp";

  useEffect(() => {
    fetch(`/cards?q=${encodeURIComponent(name)}&limit=1`)
      .then((r) => r.json())
      .then((d) => d.items?.[0] && setCard(d.items[0]))
      .catch(console.error);
  }, [name]);

  if (!card) return <div>Loading {name}…</div>;
  return (
    <img
      src={`/images/fullsize/${card.db_uuid.slice(0,2)}/${card.db_uuid}.webp`}
      alt={name}
      className="my-4 block mx-auto max-w-xs rounded shadow-lg"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = FALLBACK_FULL;
      }}
    />
  );
}

