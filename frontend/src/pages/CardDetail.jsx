import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

export default function CardDetail() {
  const { uuid } = useParams();
  const [card, setCard] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:8000/cards/${uuid}`)
      .then((res) => res.json())
      .then(setCard)
      .catch(console.error);
  }, [uuid]);

  if (!card) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold mb-2">{card.name}</h2>
      <img
        className="w-full max-w-sm mb-4"
        src={`http://localhost:8000/images/fullsize/${card.db_uuid.slice(0, 2)}/${card.db_uuid}.webp`}
        alt={card.name}
      />
      <pre className="bg-gray-900 p-4 rounded shadow text-sm whitespace-pre-wrap">
        {card.rules_text || "No rules text"}
      </pre>
    </div>
  );
}

