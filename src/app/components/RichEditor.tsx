"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

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

  const editor = useEditor({
    immediatelyRender: false, // required for Next.js SSR
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "Start writing your article… use the toolbar for headings, lists, and images." }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync in external content changes (e.g. after AI auto-fix) without clobbering typing.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== undefined) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return <div className="editor-shell"><div className="hint" style={{ padding: 16 }}>Loading editor…</div></div>;

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length || !editor) return;
    const file = files[0];
    onUploadingChange?.(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/wordpress/media", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok && data.url) {
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
      <Toolbar editor={editor} onImage={() => fileRef.current?.click()} onLink={addLink} />
      <EditorContent editor={editor} className="editor-content" />
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => handleFiles(e.target.files)} />
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
    </div>
  );
}
