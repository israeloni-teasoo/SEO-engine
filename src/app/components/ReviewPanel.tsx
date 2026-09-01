"use client";

import { useMemo, useState } from "react";
import type { SuggestedEdit, EditField } from "@/lib/ai/suggest-edits";
import { annotateContent } from "./reviewApply";

const FIELD_LABEL: Record<EditField, string> = {
  title: "Title",
  metaDescription: "Meta description",
  slug: "URL slug",
  focusKeyphrase: "Focus keyphrase",
  secondaryKeyphrases: "Secondary keyphrases",
  tags: "Tags",
  categories: "Categories",
};

export default function ReviewPanel({
  content,
  edits,
  currentField,
  onApplyField,
  onApplyContent,
  onClose,
}: {
  content: string;
  edits: SuggestedEdit[];
  currentField: (f: EditField) => string;
  onApplyField: (f: EditField, value: string) => void;
  onApplyContent: (edit: SuggestedEdit) => void;
  onClose: () => void;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [popover, setPopover] = useState<{ edit: SuggestedEdit; x: number; y: number } | null>(null);

  const active = edits.filter((e) => !dismissed.has(e.id));
  const fieldEdits = active.filter(
    (e) => e.type === "field" && e.field && e.suggested !== currentField(e.field),
  );
  const contentEdits = active.filter((e) => e.type === "content");

  const { html: annotated, matched } = useMemo(
    () => annotateContent(content, contentEdits),
    [content, contentEdits],
  );
  const unmatched = contentEdits.filter((e) => !matched.has(e.id));

  const remaining = fieldEdits.length + contentEdits.length;
  const drop = (id: string) => setDismissed((s) => new Set(s).add(id));

  function acceptField(e: SuggestedEdit) {
    if (e.field) onApplyField(e.field, e.suggested);
    drop(e.id);
  }
  function acceptContent(e: SuggestedEdit) {
    onApplyContent(e);
    drop(e.id);
    setPopover(null);
  }

  function onPreviewClick(ev: React.MouseEvent<HTMLDivElement>) {
    const el = (ev.target as HTMLElement).closest("[data-eid]") as HTMLElement | null;
    if (!el) return;
    const id = el.getAttribute("data-eid");
    const edit = contentEdits.find((e) => e.id === id);
    if (edit) setPopover({ edit, x: ev.clientX, y: ev.clientY });
  }

  return (
    <div className="card">
      <div className="card-header">
        Review suggestions — {remaining} to review
        <div className="btn-row">
          <button
            className="btn"
            style={{ padding: "3px 10px" }}
            onClick={() => {
              // Accept everything: fields first, then content (order-independent).
              fieldEdits.forEach(acceptField);
              contentEdits.forEach((e) => onApplyContent(e));
              setDismissed(new Set(edits.map((e) => e.id)));
              setPopover(null);
            }}
            disabled={remaining === 0}
          >
            Accept all
          </button>
          <button className="btn primary" style={{ padding: "3px 10px" }} onClick={onClose}>Done</button>
        </div>
      </div>
      <div className="card-body">
        {remaining === 0 && <div className="hint">All suggestions handled. Click Done to return to the editor.</div>}

        {/* Field edits */}
        {fieldEdits.map((e) => (
          <div className="review-card" key={e.id}>
            <div className="review-head">
              <span className="review-field">{e.field ? FIELD_LABEL[e.field] : "Field"}</span>
              <span className="review-reason">{e.reason}</span>
            </div>
            <div className="review-old">{currentField(e.field!) || "(empty)"}</div>
            <div className="review-new">{e.suggested}</div>
            <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn" style={{ padding: "3px 10px" }} onClick={() => drop(e.id)}>Ignore</button>
              <button className="btn primary" style={{ padding: "3px 10px" }} onClick={() => acceptField(e)}>Accept</button>
            </div>
          </div>
        ))}

        {/* Highlighted content preview */}
        {contentEdits.length > 0 && (
          <>
            <div className="check-group-title" style={{ marginTop: fieldEdits.length ? 18 : 0 }}>
              Content — click a highlighted passage to accept or ignore its fix
            </div>
            <div className="review-preview" onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: annotated }} />
          </>
        )}

        {/* Content edits we couldn't locate inline */}
        {unmatched.length > 0 && (
          <>
            <div className="check-group-title" style={{ marginTop: 16 }}>Other suggestions</div>
            {unmatched.map((e) => (
              <div className="review-card" key={e.id}>
                <div className="review-reason">{e.reason}</div>
                <div className="review-old">{e.original}</div>
                <div className="review-new">{e.suggested}</div>
                <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                  <button className="btn" style={{ padding: "3px 10px" }} onClick={() => drop(e.id)}>Ignore</button>
                  <button className="btn primary" style={{ padding: "3px 10px" }} onClick={() => acceptContent(e)}>Accept</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {popover && (
        <>
          <div className="popover-backdrop" onClick={() => setPopover(null)} />
          <div
            className="sugg-popover"
            style={{ top: Math.min(popover.y + 8, window.innerHeight - 240), left: Math.min(popover.x, window.innerWidth - 340) }}
          >
            <div className="review-reason">{popover.edit.reason}</div>
            <div className="review-old">{popover.edit.original}</div>
            <div className="review-new">{popover.edit.suggested}</div>
            <div className="btn-row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
              <button className="btn" style={{ padding: "3px 10px" }} onClick={() => { drop(popover.edit.id); setPopover(null); }}>Ignore</button>
              <button className="btn primary" style={{ padding: "3px 10px" }} onClick={() => acceptContent(popover.edit)}>Accept fix</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
