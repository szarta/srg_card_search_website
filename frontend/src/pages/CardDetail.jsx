import { useParams, Link } from "react-router-dom";
import { useMemo, useEffect, useState } from "react";
import Pagination from "../components/Pagination";
import { slugify } from "../lib/slug";
import SEO from "../components/SEO";
import JsonLd from "../components/JsonLd";

/* ----- constants outside the component (no eslint deps warnings) ----- */
const COMPETITOR_TYPES = [
  "SingleCompetitorCard",
  "TornadoCompetitorCard",
  "TrioCompetitorCard",
];

const STAT_KEYS = ["power", "technique", "agility", "strike", "submission", "grapple"];

const prettyType = (t) => (t ? t.replace(/([a-z])([A-Z])/g, "$1 $2") : "Card");

const firstSentence = (txt) => {
  if (!txt) return "";
  const s = String(txt).trim();
  const m = s.match(/.+?(?:[.!?](?=\s|$)|$)/);
  return (m ? m[0] : s).trim();
};

export default function CardDetail() {
  const { idOrSlug } = useParams();
  const [card, setCard] = useState(null);
  const [relCardsPage, setRelCardsPage] = useState(1);
  const [relFinPage, setRelFinPage] = useState(1);
  const itemsPerPage = 5;
  const [copied, setCopied] = useState(false);

  // Fetch card by uuid or slug
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

  const slug = useMemo(() => (card?.name ? slugify(card.name) : ""), [card]);

  const copySlugUrl = () => {
    if (!slug) return;
    const url = `${window.location.origin}/card/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // Build SEO fields once card is loaded (respecting only name, card_type, rules_text)
  const { seoTitle, seoDescription, canonicalUrl } = useMemo(() => {
    if (!card) {
      return {
        seoTitle: "Loading… | get-diced.com",
        seoDescription: "",
        canonicalUrl: "",
      };
    }
    const title = `${card.name} | SRG Supershow Card Search`;
    const canonical = `https://get-diced.com/card/${slug || card.db_uuid}`;

    const corePieces = [
      card.name ? `${card.name}:` : null,
      card.card_type ? prettyType(card.card_type) : null,
      firstSentence(card.rules_text) ? `Rules: ${firstSentence(card.rules_text)}` : null,
    ].filter(Boolean);

    const description = corePieces.join(" ").trim();

    return {
      seoTitle: title,
      seoDescription: description,
      canonicalUrl: canonical,
    };
  }, [card, slug]);

  // Build JSON-LD strictly to your spec — MUST be called every render
  const jsonLd = useMemo(() => {
    if (!card) return null;

    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://get-diced.com";

    const imageUrl = card?.db_uuid
      ? `${origin}/images/fullsize/${card.db_uuid.slice(0, 2)}/${card.db_uuid}.webp`
      : undefined;

    const base = {
      "@context": "https://schema.org",
      "@type": "Game",
      name: card.name,
      url: canonicalUrl || `${origin}/card/${slug || card.db_uuid}`,
      image: imageUrl,
      description: seoDescription || `${card.name}: ${prettyType(card.card_type)}`,
      identifier: card.db_uuid,
      additionalProperty: [],
    };

    // Competitors: include the 6 stats (only those that exist)
    if (COMPETITOR_TYPES.includes(card.card_type)) {
      STAT_KEYS.forEach((k) => {
        if (card[k] != null) {
          base.additionalProperty.push({
            "@type": "PropertyValue",
            name: k.charAt(0).toUpperCase() + k.slice(1),
            value: String(card[k]),
          });
        }
      });
    }

    // MainDeckCard: include deck_card_number if present
    if (card.card_type === "MainDeckCard" && card.deck_card_number != null) {
      base.additionalProperty.push({
        "@type": "PropertyValue",
        name: "Deck Card #",
        value: String(card.deck_card_number),
      });
    }

    if (base.additionalProperty.length === 0) {
      delete base.additionalProperty;
    }

    return base;
  }, [card, canonicalUrl, seoDescription, slug]);

  // ✅ Hooks are all above; now it's safe to early-return
  if (!card) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  const isCompetitor = COMPETITOR_TYPES.includes(card.card_type);

  const stats = STAT_KEYS;

  // Related/paginated sections
  const relatedCards = card.related_cards || [];
  const relCardsTotalPages = Math.ceil(relatedCards.length / itemsPerPage) || 1;
  const displayedRelatedCards = relatedCards.slice(
    (relCardsPage - 1) * itemsPerPage,
    relCardsPage * itemsPerPage
  );

  const relatedFinishes = card.related_finishes || [];
  const relFinTotalPages = Math.ceil(relatedFinishes.length / itemsPerPage) || 1;
  const displayedRelatedFinishes = relatedFinishes.slice(
    (relFinPage - 1) * itemsPerPage,
    relFinPage * itemsPerPage
  );

  const origin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://get-diced.com";
  const imageUrl = card?.db_uuid
    ? `${origin}/images/fullsize/${card.db_uuid.slice(0, 2)}/${card.db_uuid}.webp`
    : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 to-black text-white p-6">
      {/* SEO + Social previews */}
      <SEO title={seoTitle} description={seoDescription} canonical={canonicalUrl} image={imageUrl} />
      {/* Structured data */}
      <JsonLd data={jsonLd} />

      <div className="max-w-4xl mx-auto bg-neutral-900 bg-opacity-80 p-6 rounded-lg shadow-lg flex flex-col md:flex-row gap-6">
        {/* Left: Card Image */}
        <div className="flex-shrink-0">
          <img
            src={`/images/fullsize/${card.db_uuid.slice(0, 2)}/${card.db_uuid}.webp`}
            alt={`${card.name} — SRG Supershow card`}
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
                onClick={(e) => {
                  e.preventDefault();
                  copySlugUrl();
                }}
                title="Copy canonical link"
              >
                {window.location.origin}/card/{slug}
              </Link>
              <button
                onClick={copySlugUrl}
                className="px-2 py-1 bg-purple-700 hover:bg-purple-600 rounded text-xs"
              >
                Copy
              </button>
              {copied && <span className="text-green-400">Copied!</span>}
            </div>
          )}

{/* Basic Info Table */}
<div className="overflow-x-auto">
  <table className="w-full table-fixed border-collapse">
    <tbody className="text-sm align-top">
      {card.card_type && (
        <tr>
          <td className="w-32 pr-4 py-2 font-semibold text-right">Type</td>
          <td className="py-2">{card.card_type}</td>
        </tr>
      )}
      {card.atk_type && (
        <tr>
          <td className="w-32 pr-4 py-2 font-semibold text-right">Attack Type</td>
          <td className="py-2">{card.atk_type}</td>
        </tr>
      )}
      {card.play_order && (
        <tr>
          <td className="w-32 pr-4 py-2 font-semibold text-right">Play Order</td>
          <td className="py-2">{card.play_order}</td>
        </tr>
      )}
      {card.division && (
        <tr>
          <td className="w-32 pr-4 py-2 font-semibold text-right">Division</td>
          <td className="py-2">{card.division}</td>
        </tr>
      )}
      {card.gender && (
        <tr>
          <td className="w-32 pr-4 py-2 font-semibold text-right">Gender</td>
          <td className="py-2">{card.gender}</td>
        </tr>
      )}
      {card.rules_text && (
        <tr>
          <td className="w-32 pr-4 py-2 font-semibold text-right align-top">Rules</td>
          <td className="whitespace-pre-wrap text-sm py-2">{card.rules_text}</td>
        </tr>
      )}
      {isCompetitor &&
        stats.map((stat) =>
          card[stat] != null ? (
            <tr key={stat}>
              <td className="w-32 pr-4 py-2 font-semibold text-right">
                {stat.charAt(0).toUpperCase() + stat.slice(1)}
              </td>
              <td className="py-2">{card[stat]}</td>
            </tr>
          ) : null
        )}
      {card.deck_card_number != null && (
        <tr>
          <td className="w-32 pr-4 py-2 font-semibold text-right">Deck Card #</td>
          <td className="py-2">{card.deck_card_number}</td>
        </tr>
      )}
      {card.errata_text && card.errata_text.trim() !== "" && (
        <tr>
          <td className="w-32 pr-4 py-2 font-semibold text-right">Errata</td>
          <td className="text-rose-300 whitespace-pre-wrap py-2">{card.errata_text}</td>
        </tr>
      )}
      {card.tags && card.tags.length > 0 && (
        <tr>
          <td className="w-32 pr-4 py-2 font-semibold text-right align-top">Tags</td>
          <td className="py-2">
            <div className="flex flex-wrap gap-2">
              {card.tags.map((t) => (
                <span key={t} className="bg-purple-800 rounded px-2 py-0.5 text-xs">
                  {t}
                </span>
              ))}
            </div>
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>



          {/* Comments */}
          {card.comments && card.comments.trim() !== "" && (
            <div>
              <h3 className="text-lg font-semibold mb-1">Comments</h3>
              <p className="text-gray-300 text-sm bg-gray-800 bg-opacity-60 p-3 rounded whitespace-pre-wrap">
                {card.comments}
              </p>
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
                      alt={`${rc.name} — SRG Supershow card`}
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
                {displayedRelatedFinishes.map((rf) => (
                  <Link
                    to={`/card/${rf.db_uuid}`}
                    key={rf.db_uuid}
                    className="flex flex-col items-center bg-neutral-800 p-2 rounded hover:bg-neutral-700"
                  >
                    <img
                      src={`/images/thumbnails/${rf.db_uuid.slice(0, 2)}/${rf.db_uuid}.webp`}
                      alt={`${rf.name} — SRG Supershow card`}
                      className="w-20 h-28 object-cover mb-2 rounded"
                    />
                    <span className="text-sm text-center">{rf.name}</span>
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

