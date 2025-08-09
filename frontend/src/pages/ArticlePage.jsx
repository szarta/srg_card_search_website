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
    fetch(`/articles/${slug}.md`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((raw) => {
        const { data, content } = matter(raw);
        setMeta(data);
        setContent(content);
      })
      .catch(console.error);
  }, [slug]);

  if (!content) {
    return <p className="p-6 text-white">Loading…</p>;
  }

  return (
    <article className="mx-auto max-w-4xl p-6 text-white">
      {/* Hero Header */}
      <header className="mb-8">
        <h1 className="text-4xl font-bold">{meta.title}</h1>
        {meta.author && meta.date && (
          <p className="text-sm text-gray-300">
            by{" "}
            {meta.author_email ? (
              <a
                href={`mailto:${meta.author_email}`}
                className="text-blue-400 hover:underline"
              >
                {meta.author}
              </a>
            ) : (
              meta.author
            )}
            {" — "}
            {new Date(meta.date).toLocaleDateString()}
          </p>
        )}
        {meta.video && (
          <div className="mt-6 aspect-video">
            <iframe
              src={meta.video}
              title={meta.title}
              className="w-full h-full rounded-lg shadow-lg"
              allowFullScreen
            />
          </div>
        )}
      </header>

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
            <a className="text-blue-400 hover:underline" {...props} />
          ),
          // Paragraph with inline bracket parsing
          p: ({ node, children, ...props }) => {
            const text = Array.isArray(children) ? children.join("") : children;
            const parts = [];
            let lastIndex = 0;
            const re = /\[\[\[([^\]]+)\]\]\]|\[\[([^\]]+)\]\]/g;
            let m;
            while ((m = re.exec(text))) {
              if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
              if (m[1]) parts.push(<CardImage key={m.index} name={m[1].trim()} />);
              else if (m[2]) parts.push(<CardLink  key={m.index} name={m[2].trim()} />);
              lastIndex = m.index + m[0].length;
            }
            if (lastIndex < text.length) parts.push(text.slice(lastIndex));
            return <p {...props}>{parts}</p>;
          },
          // Table cell override to support inline bracket parsing
          td: ({ node, children, ...props }) => {
            const text = Array.isArray(children) ? children.join("") : children;
            const parts = [];
            let lastIndex = 0;
            const re = /\[\[\[([^\]]+)\]\]\]|\[\[([^\]]+)\]\]/g;
            let m;
            while ((m = re.exec(text))) {
              if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
              if (m[1]) parts.push(<CardImage key={m.index} name={m[1].trim()} />);
              else if (m[2]) parts.push(<CardLink  key={m.index} name={m[2].trim()} />);
              lastIndex = m.index + m[0].length;
            }
            if (lastIndex < text.length) parts.push(text.slice(lastIndex));
            return <td {...props}>{parts}</td>;
          },
{
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
            <a className="text-blue-400 hover:underline" {...props} />
          ),
          p: ({ node, children, ...props }) => {
            const parts = [];
            const re = /\[\[\[([^\]]+)\]\]\]|\[\[([^\]]+)\]\]/g;
            children.forEach((child, idx) => {
              if (typeof child === 'string') {
                let txt = child;
                let last = 0;
                let m;
                while ((m = re.exec(txt))) {
                  if (m.index > last) {
                    parts.push(txt.slice(last, m.index));
                  }
                  if (m[1]) {
                    parts.push(<CardImage key={`${idx}-${m.index}`} name={m[1].trim()} />);
                  } else if (m[2]) {
                    parts.push(<CardLink key={`${idx}-${m.index}`} name={m[2].trim()} />);
                  }
                  last = m.index + m[0].length;
                }
                if (last < txt.length) {
                  parts.push(txt.slice(last));
                }
              } else {
                parts.push(child);
              }
            });
            return <p {...props}>{parts}</p>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}

