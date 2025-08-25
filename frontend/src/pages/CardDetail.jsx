import { useParams, Link } from "react-router-dom";
import { useMemo, useEffect, useState } from "react";
import Pagination from "../components/Pagination";
import { slugify } from "../lib/slug";

export default function CardDetail() {
  const { idOrSlug } = useParams();
  const [card, setCard] = useState(null);
  const [relCardsPage, setRelCardsPage] = useState(1);
  const [relFinPage, setRelFinPage] = useState(1);
  const itemsPerPage = 5;
  const [copied, setCopied] = useState(false);
  const slug = useMemo(() => (card?.name ? slugify(card.name) : ""), [card]);

  const copySlugUrl = () => {
    if (!slug) return;
    const url = `${window.location.origin}/card/${slug}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  useEffect(() => {
      const isUuid = /^[0-9a-f]{32}$/i.test(idOrSlug);
      const url = isUuid ? `/cards/${idOrSlug}` : `/cards/slug/${idOrSlug}`;
      fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setCard(data);
        setRelCardsPage(1);
        setRelFinPage(1);
      })
      .catch(console.error);
  }, [idOrSlug]);

  if (!card) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  const stats = ["power", "technique", "agility", "strike", "submission", "grapple"];
  const competitorTypes = [
    "SingleCompetitorCard",
    "TornadoCompetitorCard",
    "TrioCompetitorCard",
  ];
  const isCompetitor = competitorTypes.includes(card.card_type);

  // Related cards pagination
  const relatedCards = card.related_cards || [];
  const relCardsTotalPages = Math.ceil(relatedCards.length / itemsPerPage);
  const displayedRelatedCards = relatedCards.slice(
    (relCardsPage - 1) * itemsPerPage,
    relCardsPage * itemsPerPage
  );

  // Related finishes pagination
  const relatedFinishes = card.related_finishes || [];
  const relFinTotalPages = Math.ceil(relatedFinishes.length / itemsPerPage);
  const displayedRelatedFinishes = relatedFinishes.slice(
    (relFinPage - 1) * itemsPerPage,
    relFinPage * itemsPerPage
  );

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
        <div className="flex-grow">
          <h1 className="text-2xl font-bold mb-4">{card.name}</h1>
            {slug && (
            <div className="mt-2 mb-4 flex items-center gap-3 text-sm">
                <span className="text-gray-400">Link:</span>
                <Link
                to={`/card/${slug}`}
                className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                >
                /card/{slug}
                </Link>
                <button
                onClick={copySlugUrl}
                className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-gray-200"
                >
                {copied ? "Copied!" : "Copy"}
                </button>
            </div>
            )}

          <table className="w-full mb-4">
            <tbody>
              {card.card_type && (
                <tr>
                  <td className="font-semibold py-1">Type</td>
                  <td>{card.card_type}</td>
                </tr>
              )}
              {card.is_banned && (
                <tr>
                  <td className="font-semibold py-1">Banned</td>
                  <td>Yes</td>
                </tr>
              )}
              {card.division && (
                <tr>
                  <td className="font-semibold py-1">Division</td>
                  <td>{card.division}</td>
               </tr>
              )}
              {card.gender && (
                <tr>
                  <td className="font-semibold py-1">Gender</td>
                  <td>{card.gender}</td>
                </tr>
              )}
              {card.rules_text && (
                <tr>
                  <td className="font-semibold py-4 align-top">Rules</td>
                  <td className="whitespace-pre-wrap text-sm pt-4 pb-2 pl-6">{card.rules_text}</td>
                </tr>
              )}
              {isCompetitor &&
                stats.map((stat) =>
                  card[stat] != null ? (
                    <tr key={stat}>
                      <td className="font-semibold py-1">
                        {stat.charAt(0).toUpperCase() + stat.slice(1)}
                      </td>
                      <td>{card[stat]}</td>
                    </tr>
                  ) : null
                )
              }
              {card.deck_card_number != null && (
                <tr>
                  <td className="font-semibold py-1">Deck Card #</td>
                  <td>{card.deck_card_number}</td>
                </tr>
              )}
              {card.errata_text && card.errata_text.trim() !== "" && (
                <tr>
                  <td className="font-semibold py-1">Errata</td>
                  <td className="whitespace-pre-wrap text-sm">{card.errata_text}</td>
                </tr>
              )}
              {card.srg_url && (
                <tr>
                  <td className="font-semibold py-1">Link</td>
                  <td>
                    <a
                      href={card.srg_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-300 hover:underline"
                    >
                      Official SRG Page
                    </a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {(card.tags || card.comments) && (
            <div className="mt-6 space-y-4">
              {card.tags && card.tags.trim() !== "" && (
                <div>
                  <h3 className="text-lg font-semibold mb-1">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {card.tags.split(",").map((tag, idx) => (
                      <span key={idx} className="bg-purple-700 bg-opacity-60 text-sm px-3 py-1 rounded-full">
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {card.comments && card.comments.trim() !== "" && (
                <div>
                  <h3 className="text-lg font-semibold mb-1">Comments</h3>
                  <p className="text-gray-300 text-sm bg-gray-800 bg-opacity-60 p-3 rounded whitespace-pre-wrap">
                    {card.comments}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Related Cards Section */}
          {relatedCards.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xl font-semibold mb-2">Related Cards</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {displayedRelatedCards.map((rc) => (
                  <Link
                    to={`/card/${rc.db_uuid}`}
                    key={rc.db_uuid}
                    className="flex flex-col items-center bg-neutral-800 p-2 rounded hover:bg-neutral-700"
                  >
                    <img
                      src={`/images/thumbnails/${rc.db_uuid.slice(0, 2)}/${rc.db_uuid}.webp`}
                      alt={rc.name}
                      className="w-20 h-28 object-cover mb-2 rounded"
                    />
                    <span className="text-sm text-center">{rc.name}</span>
                  </Link>
                ))}
              </div>
              <Pagination
                currentPage={relCardsPage}
                totalPages={relCardsTotalPages}
                onPageChange={(page) => {
                  if (page >= 1 && page <= relCardsTotalPages) setRelCardsPage(page);
                }}
              />
            </div>
          )}

          {/* Related Finishes Section */}
          {relatedFinishes.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xl font-semibold mb-2">Related Finishes</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {displayedRelatedFinishes.map((rc) => (
                  <Link
                    to={`/card/${rc.db_uuid}`}
                    key={rc.db_uuid}
                    className="flex flex-col items-center bg-neutral-800 p-2 rounded hover:bg-neutral-700"
                  >
                    <img
                      src={`/images/thumbnails/${rc.db_uuid.slice(0, 2)}/${rc.db_uuid}.webp`}
                      alt={rc.name}
                      className="w-20 h-28 object-cover mb-2 rounded"
                    />
                    <span className="text-sm text-center">{rc.name}</span>
                  </Link>
                ))}
              </div>
              <Pagination
                currentPage={relFinPage}
                totalPages={relFinTotalPages}
                onPageChange={(page) => {
                  if (page >= 1 && page <= relFinTotalPages) setRelFinPage(page);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

