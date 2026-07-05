// src/pages/ArticlePage.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import matter from "gray-matter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CardLink from "../components/CardLink";
import CardImage from "../components/CardImage";
import DeckGridFromNames from "../components/DeckGridFromNames";

// Parse [[[Name]]] (big image) and [[Name]] (link) inline
function renderBracketInline(text, keyPrefix = "t") {
  const parts = [];
  let last = 0;
  const re = /\[\[\[([^\]]+)\]\]\]|\[\[([^\]]+)\]\]/g;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1]) parts.push(<CardImage key={`${keyPrefix}-${m.index}`} name={m[1].trim()} />);
    else if (m[2]) parts.push(<CardLink key={`${keyPrefix}-${m.index}`} name={m[2].trim()} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Map ReactMarkdown children, expanding bracket syntax inside text nodes.
function renderChildrenWithBrackets(children, prefix) {
  const out = [];
  React.Children.forEach(children, (child, idx) => {
    if (typeof child === "string") out.push(...renderBracketInline(child, `${prefix}${idx}`));
    else out.push(child);
  });
  return out;
}

// Parse a ```deck code fence into { names, title }, or null for other fences.
function parseDeckFence(className, children) {
  const lang = (className || "").replace(/^language-/, "");
  if (lang !== "deck") return null;

  const names = String(children || "")
    .split(/\r?\n/)
    .map((s) => s.trim().replace(/^[-*]\s+/, "")) // allow "- Name"
    .filter(Boolean);

  let title = "Deck";
  if (/^title\s*:/i.test(names[0] || "")) {
    const first = names.shift();
    title = first.split(":").slice(1).join(":").trim() || "Deck";
  }
  return { names, title };
}

function indexCardsByName(cards) {
  const cardMap = new Map();
  cards.forEach((card) => {
    if (card?.name) cardMap.set(card.name.toLowerCase(), card);
  });
  return cardMap;
}

// Determine a card's deck slot from its position: first = competitor, second =
// entrance, MainDeckCards are deck slots, everything else is an alternate.
function buildDeckSlot(card, index) {
  if (index === 0) {
    return { slot_type: "COMPETITOR", slot_number: 0, card_uuid: card.db_uuid };
  }
  if (index === 1) {
    return { slot_type: "ENTRANCE", slot_number: 0, card_uuid: card.db_uuid };
  }
  if (card.card_type === "MainDeckCard") {
    const deckNum = card.deck_card_number || index - 1;
    return { slot_type: "DECK", slot_number: deckNum, card_uuid: card.db_uuid };
  }
  return { slot_type: "ALTERNATE", slot_number: 0, card_uuid: card.db_uuid };
}

function buildDeckPayload(names, cardMap) {
  const slots = [];
  const cardUuids = [];
  names.forEach((name, index) => {
    const card = cardMap.get(name.toLowerCase());
    if (!card?.db_uuid) return;
    cardUuids.push(card.db_uuid);
    slots.push(buildDeckSlot(card, index));
  });
  return { slots, cardUuids };
}

// Resolve names to cards, build the deck structure, create a shared list, and
// return the full shareable URL.
async function createSharedDeck(names, title, articleTitle) {
  const response = await fetch("/cards/by-names", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ names }),
  });
  if (!response.ok) throw new Error("Failed to fetch cards");
  const data = await response.json();

  const cardMap = indexCardsByName(data.rows || []);
  const { slots, cardUuids } = buildDeckPayload(names, cardMap);

  const shareResponse = await fetch("/api/shared-lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: title || "Shared Deck",
      description: `Deck from article: ${articleTitle}`,
      card_uuids: cardUuids,
      list_type: "DECK",
      deck_data: {
        spectacle_type: "NEWMAN",
        slots,
      },
    }),
  });
  if (!shareResponse.ok) throw new Error("Failed to create shared list");
  const shareData = await shareResponse.json();
  return `${window.location.origin}${shareData.url}`;
}

// ReactMarkdown component overrides. CodeBlock is supplied by the page so it can
// close over share state.
function buildMarkdownComponents(CodeBlock) {
  return {
    h1: (props) => <h1 className="text-4xl font-bold mt-8 mb-4" {...props} />,
    h2: (props) => <h2 className="text-3xl mt-6 mb-3" {...props} />,
    h3: (props) => <h3 className="text-2xl mt-5 mb-2" {...props} />,
    a: (props) => (
      <a
        className="text-cyan-300 hover:text-cyan-200 underline-offset-2 hover:underline"
        {...props}
      />
    ),
    ul: (props) => <ul className="list-disc list-outside ml-6 my-4 space-y-2" {...props} />,
    ol: (props) => <ol className="list-decimal list-outside ml-6 my-4 space-y-2" {...props} />,
    li: ({ node, children, ...props }) => (
      <li className="text-white" {...props}>
        {renderChildrenWithBrackets(children, "li")}
      </li>
    ),
    p: ({ node, children, ...props }) => (
      <p {...props}>{renderChildrenWithBrackets(children, "p")}</p>
    ),
    td: ({ node, children, ...props }) => (
      <td {...props}>{renderChildrenWithBrackets(children, "td")}</td>
    ),
    code: CodeBlock,
  };
}

function ArticleHeader({ meta }) {
  return (
    <header className="mb-8">
      <h1 className="text-4xl font-bold">{meta.title}</h1>
      {(meta.author || meta.date) && (
        <p className="text-sm text-gray-300">
          {meta.author && (
            <>
              by{" "}
              {meta.author_email ? (
                <a
                  href={`mailto:${meta.author_email}`}
                  className="text-cyan-300 hover:text-cyan-200 underline-offset-2 hover:underline"
                >
                  {meta.author}
                </a>
              ) : (
                meta.author
              )}
            </>
          )}
          {meta.date && <>{" – "}{new Date(meta.date).toLocaleDateString()}</>}
        </p>
      )}
      {meta.video && (
        <div className="mt-6 aspect-video">
          <iframe
            src={meta.video}
            title={meta.title || "Deck Video"}
            className="w-full h-full rounded-lg shadow-lg"
            allowFullScreen
          />
        </div>
      )}
    </header>
  );
}

export default function ArticlePage() {
  const { slug } = useParams();
  const [meta, setMeta] = useState({});
  const [content, setContent] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    const url = `/articles/${slug}.md`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
        return res.text();
      })
      .then((raw) => {
        const { data, content } = matter(raw);
        setMeta(data || {});
        setContent(content || "");
      })
      .catch((err) => {
        console.error("Article load error:", err);
        setContent("# Error loading article");
      });
  }, [slug]);

  if (!content) {
    return <div className="p-6 text-white">Loading…</div>;
  }

  // Share handler for decks
  const handleShareDeck = async (names, title) => {
    setSharing(true);
    setShareUrl("");

    try {
      const fullUrl = await createSharedDeck(names, title, meta.title || slug);
      setShareUrl(fullUrl);
      await navigator.clipboard.writeText(fullUrl);
    } catch (error) {
      console.error("Share error:", error);
      alert("Failed to create shareable link: " + error.message);
    } finally {
      setSharing(false);
    }
  };

  // Recognize ```deck code fences and render the grid with exports
  const CodeBlock = ({ inline, className, children, ...props }) => {
    if (inline) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    const deck = parseDeckFence(className, children);
    if (!deck) {
      return (
        <pre className={className} {...props}>
          <code>{children}</code>
        </pre>
      );
    }

    return (
      <DeckGridFromNames
        names={deck.names}
        title={deck.title}
        pageSize={40}
        onShare={() => handleShareDeck(deck.names, deck.title)}
        sharing={sharing}
        shareUrl={shareUrl}
      />
    );
  };

  return (
    // Full-width page wrapper paints background and clips any horizontal overflow
    <div className="min-h-screen w-[100dvw] bg-purple-800 overflow-x-clip">
      <article className="prose prose-invert max-w-none w-full mx-auto px-4 sm:px-6 py-6 text-white">
        <ArticleHeader meta={meta} />

        {/* Markdown Body */}
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={buildMarkdownComponents(CodeBlock)}>
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
