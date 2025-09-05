import { useEffect } from "react";

/**
 * Sets <title>, meta description, canonical, and social preview tags (OG/Twitter).
 *
 * Usage:
 *   <SEO title="..." description="..." canonical="https://..." image="https://.../fullsize/..../card.webp" />
 */
export default function SEO({ title, description, canonical, image }) {
  useEffect(() => {
    const setOrCreate = (selector, attr, value) => {
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
    };

    if (title) document.title = title;
    if (description) setOrCreate('meta[name="description"]', "content", description);
    if (canonical)   setOrCreate('link[rel="canonical"]', "href", canonical);

    // Open Graph
    if (title)       setOrCreate('meta[property="og:title"]', "content", title);
    if (description) setOrCreate('meta[property="og:description"]', "content", description);
    if (canonical)   setOrCreate('meta[property="og:url"]', "content", canonical);
    setOrCreate('meta[property="og:type"]', "content", "website");
    if (image)       setOrCreate('meta[property="og:image"]', "content", image);

    // Twitter
    setOrCreate('meta[name="twitter:card"]', "content", image ? "summary_large_image" : "summary");
    if (title)       setOrCreate('meta[name="twitter:title"]', "content", title);
    if (description) setOrCreate('meta[name="twitter:description"]', "content", description);
    if (image)       setOrCreate('meta[name="twitter:image"]', "content", image);
  }, [title, description, canonical, image]);

  return null;
}

