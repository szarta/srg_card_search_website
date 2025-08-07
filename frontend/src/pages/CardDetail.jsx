import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

export default function CardDetail() {
  const { uuid } = useParams();
  const [card, setCard] = useState(null);

  useEffect(() => {
    fetch(`/cards/${uuid}`)
      .then((res) => res.json())
      .then(setCard)
      .catch(console.error);
  }, [uuid]);

  if (!card) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  const stats = ["power", "agility", "strike", "submission", "grapple", "technique"];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-black text-white p-6">
      <div className="max-w-4xl mx-auto bg-neutral-900 bg-opacity-80 p-6 rounded-lg shadow-lg flex flex-col md:flex-row gap-6">

        {/* Left: Card Image */}
        <div className="flex-shrink-0">
          <img
            src={`/images/fullsize/${card.db_uuid.slice(0, 2)}/${card.db_uuid}.webp`}
            alt={card.name}
            className="w-full max-w-sm rounded-lg shadow"
          />
        </div>

        {/* Right: Card Details */}
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-4">{card.name}</h1>

          <pre className="whitespace-pre-wrap text-gray-200 text-sm leading-relaxed mb-4 bg-gray-800 bg-opacity-60 p-4 rounded">
            {card.rules_text || "No rules text available."}
          </pre>

          <table className="w-full text-gray-300 text-sm mb-4">
            <tbody>
              <tr>
                <td className="font-semibold py-1">Card Type</td>
                <td>{card.card_type.replace(/([A-Z])/g, ' $1').trim()}</td>
              </tr>
              {card.atk_type && (
                <tr>
                  <td className="font-semibold py-1">Attack Type</td>
                  <td>{card.atk_type}</td>
                </tr>
              )}
              {card.play_order && (
                <tr>
                  <td className="font-semibold py-1">Play Order</td>
                  <td>{card.play_order}</td>
                </tr>
              )}
              {/* Competitor stats */}
              {stats.map((stat) =>
                card[stat] != null ? (
                  <tr key={stat}>
                    <td className="font-semibold py-1">{stat.charAt(0).toUpperCase() + stat.slice(1)}</td>
                    <td>{card[stat]}</td>
                  </tr>
                ) : null
              )}
              {card.deck_card_number != null && (
                <tr>
                  <td className="font-semibold py-1">Deck Card #</td>
                  <td>{card.deck_card_number}</td>
                </tr>
              )}
            </tbody>
          </table>

            {/* Tags and Comments */}
            {(card.tags || card.comments) && (
            <div className="mt-6 space-y-4">
                {card.tags && card.tags.trim() !== "" && (
                <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                    {card.tags.split(",").map((tag, idx) => (
                        <span
                        key={idx}
                        className="bg-purple-700 bg-opacity-60 text-sm px-3 py-1 rounded-full text-white"
                        >
                        {tag.trim()}
                        </span>
                    ))}
                    </div>
                </div>
                )}
                {card.comments && card.comments.trim() !== "" && (
                <div>
                    <h3 className="text-lg font-semibold text-white mb-1">Comments</h3>
                    <p className="text-gray-300 text-sm bg-gray-800 bg-opacity-60 p-3 rounded whitespace-pre-wrap">
                    {card.comments}
                    </p>
                </div>
                )}
            </div>
            )}

        </div>
      </div>
    </div>
  );
}

