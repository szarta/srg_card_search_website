// src/pages/ArticlePage.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import matter from "gray-matter";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CardLink from "../components/CardLink";
import CardImage from "../components/CardImage";

export default function ArticlePage() {
  const { slug } = useParams();
  const [meta, setMeta] = useState({});
  const [content, setContent] = useState("");

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

  // Helper: turn bracket syntax in a string into React nodes
  const renderBracketInline = (text, keyPrefix = "t") => {
    const parts = [];
    let last = 0;
    const re = /\[\[\[([^\]]+)\]\]\]|\[\[([^\]]+)\]\]/g;
    let m;
    while ((m = re.exec(text))) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      if (m[1]) {
        // [[[Name]]] -> full-size image
        parts.push(<CardImage key={`${keyPrefix}-${m.index}`} name={m[1].trim()} />);
      } else if (m[2]) {
        // [[Name]] -> link to card detail
        parts.push(<CardLink key={`${keyPrefix}-${m.index}`} name={m[2].trim()} />);
      }
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  };

  return (
    <article className="prose prose-invert lg:prose-xl mx-auto p-6 text-white">
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
            {meta.date && <>{" — "}{new Date(meta.date).toLocaleDateString()}</>}
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
          // Heading & anchor styling
          h1: ({ node, ...props }) => (
            <h1 className="text-4xl font-bold mt-8 mb-4" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-3xl mt-6 mb-3" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-2xl mt-5 mb-2" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a className="text-cyan-300 hover:text-cyan-200 underline-offset-2 hover:underline" {...props} />
          ),

          // Paragraph override: parse bracket tokens within text nodes
          p: ({ node, children, ...props }) => {
            const out = [];
            React.Children.forEach(children, (child, idx) => {
              if (typeof child === "string") {
                out.push(...renderBracketInline(child, `p${idx}`));
              } else {
                out.push(child);
              }
            });
            return <p {...props}>{out}</p>;
          },

          // Table cell override: same parsing inside <td>
          td: ({ node, children, ...props }) => {
            const out = [];
            React.Children.forEach(children, (child, idx) => {
              if (typeof child === "string") {
                out.push(...renderBracketInline(child, `td${idx}`));
              } else {
                out.push(child);
              }
            });
            return <td {...props}>{out}</td>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

