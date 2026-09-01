"use client";

import type { SuggestedEdit } from "@/lib/ai/suggest-edits";

const BLOCK_SELECTOR = "p,h1,h2,h3,h4,h5,h6,li,blockquote";
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Wrap blocks that match a pending content edit with a highlight class + data-eid
 * so the review view can highlight them and open a popover on click.
 * Returns the annotated HTML and the set of edit ids that were located.
 */
export function annotateContent(
  html: string,
  edits: SuggestedEdit[],
): { html: string; matched: Set<string> } {
  const matched = new Set<string>();
  if (typeof window === "undefined") return { html, matched };
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = Array.from(doc.body.querySelectorAll(BLOCK_SELECTOR));
  const used = new Set<Element>();

  for (const edit of edits) {
    if (edit.type !== "content") continue;
    const target = norm(edit.original);
    if (!target) continue;
    const el =
      blocks.find((b) => !used.has(b) && norm(b.textContent || "") === target) ||
      blocks.find((b) => !used.has(b) && target.length > 20 && norm(b.textContent || "").includes(target));
    if (el) {
      used.add(el);
      el.setAttribute("data-eid", edit.id);
      el.classList.add("sugg");
      matched.add(edit.id);
    }
  }
  return { html: doc.body.innerHTML, matched };
}

/** Replace the block matching `original` with `suggested`. Returns updated HTML. */
export function applyContentEdit(
  html: string,
  edit: SuggestedEdit,
): { html: string; applied: boolean } {
  if (typeof window === "undefined") return { html, applied: false };
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = Array.from(doc.body.querySelectorAll(BLOCK_SELECTOR));
  const target = norm(edit.original);

  let el = blocks.find((b) => norm(b.textContent || "") === target);
  if (!el && target.length > 20) {
    el = blocks.find((b) => norm(b.textContent || "").includes(target));
  }
  if (!el) return { html, applied: false };

  el.textContent = edit.suggested;
  el.removeAttribute("data-eid");
  el.classList.remove("sugg");
  return { html: doc.body.innerHTML, applied: true };
}
