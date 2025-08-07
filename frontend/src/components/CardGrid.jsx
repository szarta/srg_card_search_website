export default function CardGrid({ cards }) {
  if (!cards.length) return <p className="text-center text-gray-500">No results.</p>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 p-4">
      {cards.map((card) => (
        <div key={card.db_uuid} className="text-center">
          <img
            src={`/images/thumbnails/${card.db_uuid}.webp`}
            alt={card.name}
            className="rounded shadow-md w-full"
          />
          <p className="mt-2 text-sm">{card.name}</p>
        </div>
      ))}
    </div>
  );
}
