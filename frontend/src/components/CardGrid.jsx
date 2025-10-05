import { Link, useNavigate } from "react-router-dom";

export default function CardGrid({ cards }) {
  const navigate = useNavigate();

  if (!cards || cards.length === 0) {
    return <p className="mt-4 text-gray-600">No cards found.</p>;
  }

  const thumb = (uuid) => `/images/thumbnails/${uuid.slice(0, 2)}/${uuid}.webp`;
  const FALLBACK_THUMB = "/images/thumbnails/im/image_unavailable.webp";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6 max-w-full overflow-x-hidden box-border">
      {cards.map((card, index) => {
        // Skip cards without db_uuid (not found cards)
        if (!card.db_uuid) {
          return (
            <div
              key={`notfound-${index}`}
              className="block w-full transition-transform overflow-hidden"
            >
              <img
                src={FALLBACK_THUMB}
                alt={card.name}
                className="w-full rounded shadow-md opacity-50"
                loading="lazy"
              />
              <p className="mt-1 text-sm text-center break-words text-gray-500">
                {card.name}
              </p>
            </div>
          );
        }

        return (
          <Link
            to={`/card/${card.db_uuid}`}
            onClick={(e) => {
                e.preventDefault();
                navigate(`/card/${card.db_uuid}`);
            }}
            key={card.db_uuid}
            className="block w-full transition-transform overflow-hidden md:hover:scale-105 md:focus:scale-105"
          >
            <img
              src={thumb(card.db_uuid)}
              alt={card.name}
              className="w-full rounded shadow-md"
              loading="lazy"
              onError={(e) => {
                const img = e.currentTarget;
                // failure: show thumbnail placeholder and stop
                img.onerror = null;
                img.src = FALLBACK_THUMB;
              }}
            />
            <p className="mt-1 text-sm text-center break-words">{card.name}</p>
          </Link>
        );
      })}
    </div>
  );
}
