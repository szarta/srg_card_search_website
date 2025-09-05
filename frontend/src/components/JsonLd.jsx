import { useEffect } from "react";

/**
 * Injects a JSON-LD <script> tag into <head>.
 * Usage: <JsonLd data={{ ...schemaObject }} />
 */
export default function JsonLd({ data }) {
  useEffect(() => {
    if (!data) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "jsonld-primary";
    script.text = JSON.stringify(data);
    // Replace existing, if present:
    const old = document.getElementById("jsonld-primary");
    if (old) old.remove();
    document.head.appendChild(script);
    return () => {
      const node = document.getElementById("jsonld-primary");
      if (node) node.remove();
    };
  }, [data]);
  return null;
}

