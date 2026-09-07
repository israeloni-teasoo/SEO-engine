"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { postForm } from "./api";

interface SlashCommand {
  title: string;
  hint: string;
  icon: string;
  keywords: string[];
  run: (editor: Editor, range: { from: number; to: number }) => void;
}

interface SlashState {
  query: string;
  range: { from: number; to: number };
  coords: { left: number; top: number; bottom: number };
}

export default function RichEditor({
  value,
  onChange,
  onUploadingChange,
}: {
  value: string;
  onChange: (html: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);

  // Commands available in the "/" menu. `onImage` is wired in below.
  const commandsRef = useRef<SlashCommand[]>([]);
  // Mutable view of the current menu so the editor's keydown handler (created
  // once, at editor init) always reads live state.
  const menuRef = useRef<{ open: boolean; items: SlashCommand[]; index: number }>({
    open: false, items: [], index: 0,
  });

  const editor = useEditor({
    immediatelyRender: false, // required for Next.js SSR
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: 'Write, or press "/" for headings, lists, images and more…' }),
    ],
    content: value || "",
    editorProps: {
      handleKeyDown(_view, event) {
        const menu = menuRef.current;
        if (!menu.open || menu.items.length === 0) return false;
        if (event.key === "ArrowDown") {
          setSlashIndex((i) => (i + 1) % menu.items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setSlashIndex((i) => (i - 1 + menu.items.length) % menu.items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          runSlashCommand(menu.items[menu.index]);
          return true;
        }
        if (event.key === "Escape") {
          closeSlash();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      detectSlash(editor);
    },
    onSelectionUpdate: ({ editor }) => detectSlash(editor),
    onBlur: () => {
      // Delay so a click on a menu item still registers before we close.
      setTimeout(() => closeSlash(), 120);
    },
  });

  function closeSlash() {
    setSlash(null);
    setSlashIndex(0);
  }

  function detectSlash(ed: Editor) {
    const { state } = ed;
    const { selection } = state;
    if (!selection.empty) { setSlash(null); return; }
    const $from = selection.$from;
    // Only inside plain paragraphs — don't hijack "/" in code blocks or headings.
    if ($from.parent.type.name !== "paragraph") { setSlash(null); return; }
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, "\n", "￼");
    const match = /(?:^|\s)\/([\w-]*)$/.exec(textBefore);
    if (!match) { setSlash(null); return; }
    const to = selection.from;
    const from = to - match[1].length - 1; // include the "/"
    let coords: { left: number; top: number; bottom: number };
    try {
      const c = ed.view.coordsAtPos(from);
      coords = { left: c.left, top: c.top, bottom: c.bottom };
    } catch { setSlash(null); return; }
    setSlash({ query: match[1], range: { from, to }, coords });
    setSlashIndex(0);
  }

  function runSlashCommand(cmd: SlashCommand | undefined) {
    if (!cmd || !editor) return;
    const range = slashRangeRef.current;
    closeSlash();
    if (range) cmd.run(editor, range);
    else cmd.run(editor, editor.state.selection);
  }

  // Keep the latest slash range available to runSlashCommand (called from the
  // once-bound keydown handler, which can't close over React state directly).
  const slashRangeRef = useRef<{ from: number; to: number } | null>(null);
  useEffect(() => { slashRangeRef.current = slash?.range ?? null; }, [slash]);

  // Sync in external content changes (e.g. after AI auto-fix) without clobbering typing.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== undefined) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const openImagePicker = () => fileRef.current?.click();

  // Build the command list (stable actions; `openImagePicker` closes over the ref).
  commandsRef.current = [
    { title: "Text", hint: "Plain paragraph", icon: "¶", keywords: ["paragraph", "text", "body"],
      run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
    { title: "Heading 1", hint: "Large section title", icon: "H1", keywords: ["h1", "title", "heading"],
      run: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 1 }).run() },
    { title: "Heading 2", hint: "Section heading", icon: "H2", keywords: ["h2", "heading", "subheading"],
      run: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 2 }).run() },
    { title: "Heading 3", hint: "Sub-section heading", icon: "H3", keywords: ["h3", "heading"],
      run: (e, r) => e.chain().focus().deleteRange(r).toggleHeading({ level: 3 }).run() },
    { title: "Bullet list", hint: "Unordered list", icon: "•", keywords: ["bullet", "unordered", "list", "ul"],
      run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
    { title: "Numbered list", hint: "Ordered list", icon: "1.", keywords: ["numbered", "ordered", "list", "ol"],
      run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
    { title: "Quote", hint: "Blockquote", icon: "❝", keywords: ["quote", "blockquote", "citation"],
      run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
    { title: "Code block", hint: "Monospaced code", icon: "</>", keywords: ["code", "snippet", "pre"],
      run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
    { title: "Divider", hint: "Horizontal rule", icon: "―", keywords: ["divider", "hr", "rule", "separator"],
      run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
    { title: "Image", hint: "Upload an image", icon: "🖼", keywords: ["image", "picture", "photo", "media"],
      run: (e, r) => { e.chain().focus().deleteRange(r).run(); openImagePicker(); } },
  ];

  const filteredCommands = (() => {
    if (!slash) return [];
    const q = slash.query.trim().toLowerCase();
    if (!q) return commandsRef.current;
    return commandsRef.current.filter((c) =>
      c.title.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q)),
    );
  })();

  // If a query filters everything out, close the menu instead of showing nothing.
  useEffect(() => {
    if (slash && filteredCommands.length === 0) closeSlash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slash, filteredCommands.length]);

  const activeIndex = filteredCommands.length ? slashIndex % filteredCommands.length : 0;
  useEffect(() => {
    menuRef.current = { open: Boolean(slash) && filteredCommands.length > 0, items: filteredCommands, index: activeIndex };
  });

  if (!editor) return <div className="editor-shell"><div className="hint" style={{ padding: 16 }}>Loading editor…</div></div>;

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length || !editor) return;
    const file = files[0];
    onUploadingChange?.(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { ok, data } = await postForm("/api/wordpress/media", form);
      if (ok && data.url) {
        editor.chain().focus().setImage({ src: data.url, alt: "" }).run();
      }
    } finally {
      onUploadingChange?.(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addLink() {
    const url = window.prompt("Link URL");
    if (url === null) return;
    if (url === "") editor!.chain().focus().unsetLink().run();
    else editor!.chain().focus().setLink({ href: url }).run();
  }

  return (
    <div className="editor-shell">
      <Toolbar editor={editor} onImage={openImagePicker} onLink={addLink} />
      <EditorContent editor={editor} className="editor-content" />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => handleFiles(e.target.files)} />
      {slash && filteredCommands.length > 0 && (
        <SlashMenu
          commands={filteredCommands}
          index={activeIndex}
          coords={slash.coords}
          onPick={(cmd) => runSlashCommand(cmd)}
          onHover={setSlashIndex}
        />
      )}
    </div>
  );
}

function SlashMenu({
  commands, index, coords, onPick, onHover,
}: {
  commands: SlashCommand[];
  index: number;
  coords: { left: number; top: number; bottom: number };
  onPick: (cmd: SlashCommand) => void;
  onHover: (i: number) => void;
}) {
  const MENU_HEIGHT = 300;
  const below = coords.bottom + 6;
  const flipUp = typeof window !== "undefined" && below + MENU_HEIGHT > window.innerHeight;
  const top = flipUp ? Math.max(8, coords.top - 6 - MENU_HEIGHT) : below;
  const left = Math.min(coords.left, (typeof window !== "undefined" ? window.innerWidth : 9999) - 260);

  return (
    <div className="slash-menu" style={{ top, left }} onMouseDown={(e) => e.preventDefault()}>
      <div className="slash-menu-title">Blocks</div>
      {commands.map((c, i) => (
        <button
          key={c.title}
          type="button"
          className={`slash-item ${i === index ? "active" : ""}`}
          onMouseEnter={() => onHover(i)}
          onClick={() => onPick(c)}
        >
          <span className="slash-icon">{c.icon}</span>
          <span className="slash-text">
            <span className="slash-name">{c.title}</span>
            <span className="slash-hint">{c.hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function Toolbar({ editor, onImage, onLink }: { editor: Editor; onImage: () => void; onLink: () => void }) {
  const B = ({ on, active, label, title }: { on: () => void; active?: boolean; label: string; title: string }) => (
    <button type="button" title={title} className={`tb-btn ${active ? "active" : ""}`} onClick={on}>
      {label}
    </button>
  );
  return (
    <div className="toolbar">
      <B title="Paragraph" label="¶" active={editor.isActive("paragraph")} on={() => editor.chain().focus().setParagraph().run()} />
      <B title="Heading 2" label="H2" active={editor.isActive("heading", { level: 2 })} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
      <B title="Heading 3" label="H3" active={editor.isActive("heading", { level: 3 })} on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
      <span className="tb-sep" />
      <B title="Bold" label="B" active={editor.isActive("bold")} on={() => editor.chain().focus().toggleBold().run()} />
      <B title="Italic" label="I" active={editor.isActive("italic")} on={() => editor.chain().focus().toggleItalic().run()} />
      <B title="Link" label="🔗" active={editor.isActive("link")} on={onLink} />
      <span className="tb-sep" />
      <B title="Bullet list" label="•" active={editor.isActive("bulletList")} on={() => editor.chain().focus().toggleBulletList().run()} />
      <B title="Numbered list" label="1." active={editor.isActive("orderedList")} on={() => editor.chain().focus().toggleOrderedList().run()} />
      <B title="Quote" label="❝" active={editor.isActive("blockquote")} on={() => editor.chain().focus().toggleBlockquote().run()} />
      <span className="tb-sep" />
      <B title="Insert image" label="🖼" on={onImage} />
      <span className="tb-sep" />
      <B title="Undo" label="↶" on={() => editor.chain().focus().undo().run()} />
      <B title="Redo" label="↷" on={() => editor.chain().focus().redo().run()} />
      <span className="tb-sep" />
      <span className="tb-hint">Type <kbd>/</kbd> for blocks</span>
    </div>
  );
}
