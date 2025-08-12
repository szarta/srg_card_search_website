import { useEffect, useState } from "react";
import { slugify } from "../lib/slug";

export default function CardImage({ name }) {
  const [card, setCard] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const FALLBACK_FULL = "/images/fullsize/im/image_unavailable.webp";

  useEffect(() => {
    let cancelled = false;
    setNotFound(false);
    setCard(null);

    const s = slugify(name);

    // 1) Try slug
    fetch(`/cards/slug/${s}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        if (!cancelled) setCard(data);
      })
      .catch(() => {
        // 2) Fallback: exact name from search results only
        fetch(`/cards?q=${encodeURIComponent(name)}&limit=50`)
          .then((r) => (r.ok ? r.json() : { items: [] }))
          .then((d) => {
            if (cancelled) return;
            const items = Array.isArray(d.items) ? d.items : [];
            const bySlug = items.find((c) => slugify(c.name) === s);
            const byName = items.find(
              (c) => c.name?.toLowerCase() === name.toLowerCase()
            );
            if (bySlug || byName) setCard(bySlug || byName);
            else setNotFound(true);
          })
          .catch(() => {
            if (!cancelled) setNotFound(true);
          });
      });

    return () => {
      cancelled = true;
    };
  }, [name]);

  if (notFound) {
    return (
      <img
        src={FALLBACK_FULL}
        alt={name}
        className="my-4 block mx-auto max-w-xs rounded shadow-lg"
      />
    );
  }

  if (!card) return <div>Loading {name}…</div>;

  return (
    <img
      src={`/images/fullsize/${card.db_uuid.slice(0, 2)}/${card.db_uuid}.webp`}
      alt={name}
      className="my-4 block mx-auto max-w-xs rounded shadow-lg"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = FALLBACK_FULL;
      }}
    />
  );
}

