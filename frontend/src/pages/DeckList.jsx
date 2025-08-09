// src/pages/DeckList.jsx
import { Link } from "react-router-dom";

const articles = [
  { slug: "the-rising-sun-example",        title: "Rising Sun Example Deck" },
  // { slug: "another-deck",      title: "Another Deck Article" },
];

export default function DeckList() {
  return (
    <div className="p-6 text-white">
      <h1 className="text-3xl font-bold mb-4">Deck Articles</h1>
      <ul className="list-disc pl-6 space-y-2">
        {articles.map(({ slug, title }) => (
          <li key={slug}>
            <Link
              to={`/decks/${slug}`}
              className="text-blue-400 hover:underline"
            >
              {title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
