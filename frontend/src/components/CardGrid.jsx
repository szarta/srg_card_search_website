import { Link } from "react-router-dom";

export default function CardGrid({ cards }) {
  if (!cards || cards.length === 0) {
    return <p className="mt-4 text-gray-600">No cards found.</p>;
  }

  const thumb = (uuid) => `/images/thumbnails/${uuid.slice(0, 2)}/${uuid}.webp`;
  const full  = (uuid) => `/images/fullsize/${uuid.slice(0, 2)}/${uuid}.webp`;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
      {cards.map((card) => (
        <Link
          to={`/card/${card.db_uuid}`}
          key={card.db_uuid}
          className="block hover:scale-105 transition-transform"
        >
          <img
            src={thumb(card.db_uuid)}
            alt={card.name}
            className="w-full rounded shadow-md"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = full(card.db_uuid);
            }}
          />
          <p className="mt-1 text-sm text-center">{card.name}</p>
        </Link>
      ))}
    </div>
  );
}

