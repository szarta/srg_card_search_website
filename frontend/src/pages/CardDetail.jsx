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

const capitalize = (k) => k.charAt(0).toUpperCase() + k.slice(1);

/* Format a requirement object into a readable label.
   Skill requirements look like { min_strike: 8 } -> "Strike 8+".
   Falls back gracefully for freeform / not-yet-modeled requirement shapes. */
const formatRequirement = (req) => {
  if (req == null) return "";
  if (typeof req !== "object") return String(req);
  if (typeof req.text === "string") return req.text;
  return Object.entries(req)
    .map(([k, v]) => {
      const m = /^min_(.+)$/.exec(k);
      return m ? `${capitalize(m[1])} ${v}+` : `${capitalize(k)}: ${v}`;
    })
    .join(", ");
};

function getOrigin() {
  return typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "https://get-diced.com";
}

// Origin-prefixed fullsize image URL (used for SEO/JSON-LD), or undefined.
function fullsizeImageUrl(card) {
  if (!card?.db_uuid) return undefined;
  return `${getOrigin()}/images/fullsize/${card.db_uuid.slice(0, 2)}/${card.db_uuid}.webp`;
}

// Title / description / canonical URL for the card (or loading placeholders).
function buildSeo(card, slug) {
  if (!card) {
    return {
      seoTitle: "Loading… | get-diced.com",
      seoDescription: "",
      canonicalUrl: "",
    };
  }

  const corePieces = [
    card.name ? `${card.name}:` : null,
    card.card_type ? prettyType(card.card_type) : null,
    firstSentence(card.rules_text) ? `Rules: ${firstSentence(card.rules_text)}` : null,
  ].filter(Boolean);

  return {
    seoTitle: `${card.name} | SRG Supershow Card Search`,
    seoDescription: corePieces.join(" ").trim(),
    canonicalUrl: `https://get-diced.com/card/${slug || card.db_uuid}`,
  };
}

// schema.org Game structured data for the card.
function buildJsonLd(card, canonicalUrl, seoDescription, slug) {
  if (!card) return null;

  const origin = getOrigin();
  const base = {
    "@context": "https://schema.org",
    "@type": "Game",
    name: card.name,
    url: canonicalUrl || `${origin}/card/${slug || card.db_uuid}`,
    image: fullsizeImageUrl(card),
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
          name: capitalize(k),
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
}

// A single label/value row in the basic info table (renders nothing when no value).
function InfoRow({ label, show = true, children }) {
  if (!show) return null;
  return (
    <tr>
      <td className="w-32 pr-4 py-2 font-semibold text-right">{label}</td>
      <td className="py-2">{children}</td>
    </tr>
  );
}

// Basic card attributes table.
function CardInfoTable({ card, isCompetitor, stats }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse">
        <tbody className="text-sm align-top">
          <InfoRow label="Type" show={!!card.card_type}>{card.card_type}</InfoRow>
          <InfoRow label="Attack Type" show={!!card.atk_type}>{card.atk_type}</InfoRow>
          <InfoRow label="Play Order" show={!!card.play_order}>{card.play_order}</InfoRow>
          {card.srg_url && (
            <tr>
              <td className="w-32 pr-4 py-2 font-semibold text-right">Link</td>
              <td className="py-2">
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
          {card.srgpc_url && (
            <tr>
              <td className="w-32 pr-4 py-2 font-semibold text-right">Link</td>
              <td className="py-2">
                <a
                  href={card.srgpc_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-300 hover:underline"
                >
                  SRGPC Page
                </a>
              </td>
            </tr>
          )}
          <InfoRow label="Banned" show={!!card.is_banned}>Yes</InfoRow>
          <InfoRow label="Division" show={!!card.division}>{card.division}</InfoRow>
          {card.rules_text && (
            <tr>
              <td className="w-32 pr-4 py-2 font-semibold text-right align-top">Rules</td>
              <td className="whitespace-pre-wrap text-sm py-2">{card.rules_text}</td>
            </tr>
          )}
          {card.requirements && card.requirements.length > 0 && (
            <tr>
              <td className="w-32 pr-4 py-2 font-semibold text-right align-top">Requirements</td>
              <td className="py-2">
                <div className="flex flex-wrap gap-2">
                  {card.requirements.map((req, i) => (
                    <span key={i} className="bg-amber-800 rounded px-2 py-0.5 text-xs">
                      {formatRequirement(req)}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          )}
          {isCompetitor &&
            stats.map((stat) =>
              card[stat] != null ? (
                <InfoRow key={stat} label={capitalize(stat)}>{card[stat]}</InfoRow>
              ) : null
            )}
          <InfoRow label="Deck Card #" show={card.deck_card_number != null}>
            {card.deck_card_number}
          </InfoRow>
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
  );
}

// Paginated grid of related cards/finishes (renders nothing when empty).
function RelatedSection({ title, items, currentPage, itemsPerPage, onPageChange }) {
  if (items.length === 0) return null;

  const totalPages = Math.ceil(items.length / itemsPerPage) || 1;
  const displayed = items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="mt-8">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {displayed.map((rc) => (
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
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={(page) => {
          if (page >= 1 && page <= totalPages) onPageChange(page);
        }}
      />
    </div>
  );
}

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
  const { seoTitle, seoDescription, canonicalUrl } = useMemo(
    () => buildSeo(card, slug),
    [card, slug]
  );

  // Build JSON-LD strictly to your spec — MUST be called every render
  const jsonLd = useMemo(
    () => buildJsonLd(card, canonicalUrl, seoDescription, slug),
    [card, canonicalUrl, seoDescription, slug]
  );

  // ✅ Hooks are all above; now it's safe to early-return
  if (!card) return <div className="p-4 text-center text-gray-400">Loading...</div>;

  const isCompetitor = COMPETITOR_TYPES.includes(card.card_type);
  const relatedCards = card.related_cards || [];
  const relatedFinishes = card.related_finishes || [];
  const imageUrl = fullsizeImageUrl(card);

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

          <CardInfoTable card={card} isCompetitor={isCompetitor} stats={STAT_KEYS} />

          {/* Comments */}
          {card.comments && card.comments.trim() !== "" && (
            <div>
              <h3 className="text-lg font-semibold mb-1">Comments</h3>
              <p className="text-gray-300 text-sm bg-gray-800 bg-opacity-60 p-3 rounded whitespace-pre-wrap">
                {card.comments}
              </p>
            </div>
          )}

          <RelatedSection
            title="Related Cards"
            items={relatedCards}
            currentPage={relCardsPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setRelCardsPage}
          />

          <RelatedSection
            title="Related Finishes"
            items={relatedFinishes}
            currentPage={relFinPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setRelFinPage}
          />
        </div>
      </div>
    </div>
  );
}
