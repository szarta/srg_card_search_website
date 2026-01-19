// src/pages/DeckList.jsx
import { Link } from "react-router-dom";

const articles = [
  { slug: "citizen-x",              title: "Citizen X" },
  { slug: "moonstar",               title: "Moonstar" },
  { slug: "d2",                     title: "D2" },
  { slug: "unique",                 title: "Unique" },
  { slug: "alex-kane",              title: "Alex Kane"},
  { slug: "real-beater",            title: "Real Beater"},
  { slug: "postal-nation",          title: "Leader of the Postal Nation"},
  { slug: "wendigo",                title: "Wendigo"},
  { slug: "mila-mai-2021",          title: "2021 Deck of the Year Mila Mai"},
  { slug: "hiroshi",                title: "Hiroshi Tanahashi"},
  { slug: "chamomile-t",            title: "Chamomile T"},
  { slug: "raven",                  title: "Raven"},
  { slug: "mortician",              title: "Mortician (V1)"},
  { slug: "effy",                   title: "Effy"},
  { slug: "yamatohama",             title: "Yamatohama"},
  { slug: "riggs-simmons",          title: "Riggs Simmons (V1)"},
  { slug: "ken-broadway",           title: "Ken Broadway"},
  { slug: "jurassic-juggernaut",    title: "Jurassic Juggernaut"},
  { slug: "numer01",                title: "Numer01"},
  { slug: "titan",                  title: "Titan"},
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
              className="text-cyan-300 hover:underline"
            >
              {title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
