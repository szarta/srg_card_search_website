import { Link } from "react-router-dom";

export default function CardGrid({ cards }) {
  if (!cards || cards.length === 0) {
    return <p className="mt-4 text-gray-600">No cards found.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
      {cards.map((card) => (
        <Link
          to={`/card/${card.db_uuid}`}
          key={card.db_uuid}
          className="block hover:scale-105 transition-transform"
        >
          <img
            src={`http://localhost:8000/images/thumbnails/${card.db_uuid.slice(0, 2)}/${card.db_uuid}.webp`}
            alt={card.name}
            className="w-full rounded shadow-md"
          />
          <p className="mt-1 text-sm text-center">{card.name}</p>
        </Link>
      ))}
    </div>
  );
}

