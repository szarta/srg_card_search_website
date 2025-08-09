import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

export default function CardLink({ name }) {
  const [card, setCard] = useState(null);

  useEffect(() => {
    fetch(`/cards?q=${encodeURIComponent(name)}&limit=1`)
      .then((r) => r.json())
      .then((d) => d.items?.[0] && setCard(d.items[0]))
      .catch(console.error);
  }, [name]);

  if (!card) return <span className="italic">{name}</span>;

  return (
    <Link
      to={`/card/${card.db_uuid}`}
      className="text-blue-400 hover:underline"
    >
      {name}
    </Link>
  );
}
