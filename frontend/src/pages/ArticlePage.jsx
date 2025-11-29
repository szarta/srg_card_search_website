// src/pages/ArticlePage.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import matter from "gray-matter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CardLink from "../components/CardLink";
import CardImage from "../components/CardImage";
import DeckGridFromNames from "../components/DeckGridFromNames";

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

  // Parse [[[Name]]] (big image) and [[Name]] (link) inline
  const renderBracketInline = (text, keyPrefix = "t") => {
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
  };

  // Share handler for decks
  const handleShareDeck = async (names, title) => {
    setSharing(true);
    setShareUrl("");

    try {
      // Fetch all cards by name to build deck structure
      const response = await fetch("/cards/by-names", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
      });

      if (!response.ok) throw new Error("Failed to fetch cards");

      const data = await response.json();
      const cards = data.rows || [];

      // Build card map
      const cardMap = new Map();
      cards.forEach(card => {
        if (card?.name) {
          cardMap.set(card.name.toLowerCase(), card);
        }
      });

      // Determine deck structure from card order
      // First card should be competitor, second is entrance, rest are deck cards
      const slots = [];
      const cardUuids = [];
      let spectacleType = "NEWMAN"; // default

      names.forEach((name, index) => {
        const card = cardMap.get(name.toLowerCase());
        if (!card?.db_uuid) return;

        cardUuids.push(card.db_uuid);

        if (index === 0) {
          // First card is competitor
          slots.push({
            slot_type: "COMPETITOR",
            slot_number: 0,
            card_uuid: card.db_uuid
          });
        } else if (index === 1) {
          // Second card is entrance
          slots.push({
            slot_type: "ENTRANCE",
            slot_number: 0,
            card_uuid: card.db_uuid
          });
        } else if (card.card_type === "MainDeckCard") {
          // Deck cards (slots 1-30)
          const deckNum = card.deck_card_number || (index - 1);
          slots.push({
            slot_type: "DECK",
            slot_number: deckNum,
            card_uuid: card.db_uuid
          });
        } else {
          // Everything else goes to alternates
          slots.push({
            slot_type: "ALTERNATE",
            slot_number: 0,
            card_uuid: card.db_uuid
          });
        }
      });

      // Create shared list
      const shareResponse = await fetch("/api/shared-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: title || "Shared Deck",
          description: `Deck from article: ${meta.title || slug}`,
          card_uuids: cardUuids,
          list_type: "DECK",
          deck_data: {
            spectacle_type: spectacleType,
            slots: slots
          }
        }),
      });

      if (!shareResponse.ok) throw new Error("Failed to create shared list");

      const shareData = await shareResponse.json();
      const fullUrl = `${window.location.origin}${shareData.url}`;

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
    if (inline) return <code className={className} {...props}>{children}</code>;
    const lang = (className || "").replace(/^language-/, "");
    if (lang !== "deck") {
      return <pre className={className} {...props}><code>{children}</code></pre>;
    }
    const raw = String(children || "");
    const names = raw
      .split(/\r?\n/)
      .map((s) => s.trim().replace(/^[-*]\s+/, "")) // allow "- Name"
      .filter(Boolean);

    let title = "Deck";
    if (/^title\s*:/i.test(names[0] || "")) {
      const first = names.shift();
      title = first.split(":").slice(1).join(":").trim() || "Deck";
    }

    return (
      <DeckGridFromNames
        names={names}
        title={title}
        pageSize={40}
        onShare={() => handleShareDeck(names, title)}
        sharing={sharing}
        shareUrl={shareUrl}
        listName={title}
      />
    );
  };

  return (
    // Full-width page wrapper paints background and clips any horizontal overflow
    <div className="min-h-screen w-[100dvw] bg-purple-800 overflow-x-clip">
      <article className="prose prose-invert max-w-none w-full mx-auto px-4 sm:px-6 py-6 text-white">
        {/* Header */}
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

        {/* Markdown Body */}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: (props) => <h1 className="text-4xl font-bold mt-8 mb-4" {...props} />,
            h2: (props) => <h2 className="text-3xl mt-6 mb-3" {...props} />,
            h3: (props) => <h3 className="text-2xl mt-5 mb-2" {...props} />,
            a:  (props) => <a className="text-cyan-300 hover:text-cyan-200 underline-offset-2 hover:underline" {...props} />,
            ul: (props) => <ul className="list-disc list-outside ml-6 my-4 space-y-2" {...props} />,
            ol: (props) => <ol className="list-decimal list-outside ml-6 my-4 space-y-2" {...props} />,
            li: ({ node, children, ...props }) => {
              const out = [];
              React.Children.forEach(children, (child, idx) => {
                if (typeof child === "string") out.push(...renderBracketInline(child, `li${idx}`));
                else out.push(child);
              });
              return <li className="text-white" {...props}>{out}</li>;
            },
            p: ({ node, children, ...props }) => {
              const out = [];
              React.Children.forEach(children, (child, idx) => {
                if (typeof child === "string") out.push(...renderBracketInline(child, `p${idx}`));
                else out.push(child);
              });
              return <p {...props}>{out}</p>;
            },
            td: ({ node, children, ...props }) => {
              const out = [];
              React.Children.forEach(children, (child, idx) => {
                if (typeof child === "string") out.push(...renderBracketInline(child, `td${idx}`));
                else out.push(child);
              });
              return <td {...props}>{out}</td>;
            },
            code: CodeBlock,
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
