import { useEffect } from "react";

// Create the tag matching `selector` if missing, then set `attr` to `value`.
// No-ops when `value` is falsy, so callers can pass optional values directly.
function setOrCreate(selector, attr, value) {
  if (!value) return;
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement(selector.startsWith("meta") ? "meta" : "link");
    if (selector.startsWith('meta[name="')) {
      el.setAttribute("name", selector.match(/meta\[name="([^"]+)"\]/)[1]);
    } else if (selector.startsWith('meta[property="')) {
      el.setAttribute("property", selector.match(/meta\[property="([^"]+)"\]/)[1]);
    } else if (selector.startsWith('link[rel="')) {
      el.setAttribute("rel", selector.match(/link\[rel="([^"]+)"\]/)[1]);
    }
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

/**
 * Sets <title>, meta description, canonical, and social preview tags (OG/Twitter).
 *
 * Usage:
 *   <SEO title="..." description="..." canonical="https://..." image="https://.../fullsize/..../card.webp" />
 */
export default function SEO({ title, description, canonical, image }) {
  useEffect(() => {
    if (title) document.title = title;

    // [selector, attribute, value] — falsy values are skipped by setOrCreate.
    const tags = [
      ['meta[name="description"]', "content", description],
      ['link[rel="canonical"]', "href", canonical],
      // Open Graph
      ['meta[property="og:title"]', "content", title],
      ['meta[property="og:description"]', "content", description],
      ['meta[property="og:url"]', "content", canonical],
      ['meta[property="og:type"]', "content", "website"],
      ['meta[property="og:image"]', "content", image],
      // Twitter
      ['meta[name="twitter:card"]', "content", image ? "summary_large_image" : "summary"],
      ['meta[name="twitter:title"]', "content", title],
      ['meta[name="twitter:description"]', "content", description],
      ['meta[name="twitter:image"]', "content", image],
    ];
    for (const [selector, attr, value] of tags) {
      setOrCreate(selector, attr, value);
    }
  }, [title, description, canonical, image]);

  return null;
}

