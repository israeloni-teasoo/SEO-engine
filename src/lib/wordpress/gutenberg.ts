import { parse as parseHtml, HTMLElement, Node, NodeType } from "node-html-parser";

// Convert plain HTML (from the editor) into WordPress block markup so the post
// opens in the native block editor instead of a single "Classic" block.
// Each top-level element is wrapped in the matching Gutenberg block comment.

function esc(s: string): string {
  return s.replace(/"/g, "&quot;");
}

function blockFor(el: HTMLElement): string {
  const tag = el.tagName?.toLowerCase();
  const inner = el.innerHTML.trim();

  switch (tag) {
    case "p":
      if (!el.text.trim() && !/<img/i.test(inner)) return "";
      return `<!-- wp:paragraph -->\n<p>${inner}</p>\n<!-- /wp:paragraph -->`;
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const level = Number(tag[1]);
      const attr = level === 2 ? "" : ` {"level":${level}}`;
      return `<!-- wp:heading${attr} -->\n<${tag} class="wp-block-heading">${inner}</${tag}>\n<!-- /wp:heading -->`;
    }
    case "ul":
    case "ol": {
      const ordered = tag === "ol";
      const items = el
        .querySelectorAll("li")
        .map((li) => `<!-- wp:list-item -->\n<li>${li.innerHTML.trim()}</li>\n<!-- /wp:list-item -->`)
        .join("\n");
      const attr = ordered ? ' {"ordered":true}' : "";
      return `<!-- wp:list${attr} -->\n<${tag}>${items ? `\n${items}\n` : ""}</${tag}>\n<!-- /wp:list -->`;
    }
    case "blockquote":
      return `<!-- wp:quote -->\n<blockquote class="wp-block-quote">${inner}</blockquote>\n<!-- /wp:quote -->`;
    case "pre":
      return `<!-- wp:code -->\n<pre class="wp-block-code">${inner}</pre>\n<!-- /wp:code -->`;
    case "hr":
      return `<!-- wp:separator -->\n<hr class="wp-block-separator"/>\n<!-- /wp:separator -->`;
    case "figure":
    case "img": {
      const img = tag === "img" ? el : el.querySelector("img");
      if (!img) return `<!-- wp:html -->\n${el.outerHTML}\n<!-- /wp:html -->`;
      const src = img.getAttribute("src") ?? "";
      const alt = img.getAttribute("alt") ?? "";
      return `<!-- wp:image -->\n<figure class="wp-block-image"><img src="${src}" alt="${esc(alt)}"/></figure>\n<!-- /wp:image -->`;
    }
    case "table":
      return `<!-- wp:table -->\n<figure class="wp-block-table">${el.outerHTML}</figure>\n<!-- /wp:table -->`;
    default:
      // Wrap anything unrecognised as a raw HTML block.
      return `<!-- wp:html -->\n${el.outerHTML}\n<!-- /wp:html -->`;
  }
}

/**
 * Serialize editor HTML into WordPress block markup. Loose text nodes become
 * paragraphs; recognised block elements map to their Gutenberg block.
 */
export function htmlToGutenberg(html: string): string {
  const root = parseHtml(html, { comment: false });
  const blocks: string[] = [];

  for (const node of root.childNodes) {
    if (node.nodeType === NodeType.TEXT_NODE) {
      const text = (node as Node).text.trim();
      if (text) blocks.push(`<!-- wp:paragraph -->\n<p>${text}</p>\n<!-- /wp:paragraph -->`);
      continue;
    }
    if (node.nodeType === NodeType.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const block = blockFor(el);
      if (block) blocks.push(block);
    }
  }

  return blocks.join("\n\n");
}
