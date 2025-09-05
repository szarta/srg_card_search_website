import { useEffect } from "react";

/**
 * Lightweight SEO component that sets <title>, <meta name="description">,
 * and <link rel="canonical"> without any external libraries.
 *
 * Usage:
 *   <SEO title="..." description="..." canonical="https://get-diced.com/page" />
 */
export default function SEO({ title, description, canonical }) {
  useEffect(() => {
    if (title) document.title = title;

    if (description) {
      let tag = document.querySelector('meta[name="description"]');
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", "description");
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", description);
    }

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", canonical);
    }
  }, [title, description, canonical]);

  return null;
}

