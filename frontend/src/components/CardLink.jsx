import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { slugify } from "../lib/slug";

export default function CardLink({ name }) {
  const [card, setCard] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const s = slugify(name);

    // 1) Precise slug endpoint
    fetch(`/cards/slug/${s}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        if (!cancelled) setCard(data);
      })
      .catch(() => {
        // 2) Fallback: search, but only accept exact name matches
        fetch(`/cards?q=${encodeURIComponent(name)}&limit=50`)
          .then((r) => (r.ok ? r.json() : { items: [] }))
          .then((d) => {
            if (cancelled) return;
            const items = Array.isArray(d.items) ? d.items : [];
            const bySlug = items.find((c) => slugify(c.name) === s);
            const byName = items.find(
              (c) => c.name?.toLowerCase() === name.toLowerCase()
            );
            setCard(bySlug || byName || null);
          })
          .catch(() => {
            if (!cancelled) setCard(null);
          });
      });

    return () => {
      cancelled = true;
    };
  }, [name]);

  if (!card) return <span className="italic">{name}</span>;

  const s = slugify(card.name); // canonical slug link
  return (
    <Link
      to={`/card/${s}`}
      className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
    >
      {card.name}
    </Link>
  );
}

