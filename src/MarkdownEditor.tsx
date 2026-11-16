import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { htmlToMarkdown, type MdNode } from "./htmlToMarkdown";

function markdownToHtml(text: string): string {
  return renderToStaticMarkup(<ReactMarkdown skipHtml remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>);
}

const tools: Array<{ label: string; title: string; run: () => void }> = [
  { label: "B", title: "Bold", run: () => document.execCommand("bold") },
  { label: "I", title: "Italic", run: () => document.execCommand("italic") },
  { label: "S", title: "Strikethrough", run: () => document.execCommand("strikeThrough") },
  { label: "H1", title: "Heading 1", run: () => document.execCommand("formatBlock", false, "h1") },
  { label: "H2", title: "Heading 2", run: () => document.execCommand("formatBlock", false, "h2") },
  { label: "H3", title: "Heading 3", run: () => document.execCommand("formatBlock", false, "h3") },
  { label: "¶", title: "Normal text", run: () => document.execCommand("formatBlock", false, "p") },
  { label: "•", title: "Bulleted list", run: () => document.execCommand("insertUnorderedList") },
  { label: "1.", title: "Numbered list", run: () => document.execCommand("insertOrderedList") },
  { label: "❝", title: "Quote", run: () => document.execCommand("formatBlock", false, "blockquote") },
  { label: "</>", title: "Code", run: () => { const text = window.getSelection()?.toString() ?? ""; document.execCommand("insertHTML", false, `<code>${text.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!) || "code"}</code>`); } },
  { label: "🔗", title: "Link", run: () => { const url = prompt("Link URL (https://…)"); if (url && /^(https?:|mailto:)/i.test(url.trim())) document.execCommand("createLink", false, url.trim()); } },
  { label: "—", title: "Divider", run: () => document.execCommand("insertHorizontalRule") },
];

/** WYSIWYG editor that stores Markdown: edits rendered HTML, converts back on save; a source mode edits Markdown directly. */
export function MarkdownEditor({ value, onSave, onCancel, label, saveLabel = "Save" }: { value: string; onSave: (markdown: string) => void; onCancel: () => void; label: string; saveLabel?: string }) {
  const editor = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState(false);
  const [markdown, setMarkdown] = useState(value);

  useEffect(() => {
    if (!source && editor.current) { editor.current.innerHTML = markdownToHtml(markdown); editor.current.focus(); }
    // Re-render only when switching modes; typing must not reset the caret.
  }, [source]);

  const current = () => source || !editor.current ? markdown : htmlToMarkdown(editor.current as unknown as MdNode);
  const toggleSource = () => { setMarkdown(current()); setSource(!source); };

  return <div className="markdown-editor">
    <div className="markdown-toolbar" role="toolbar" aria-label={`Formatting: ${label}`}>
      {!source && tools.map((tool) => <button key={tool.title} type="button" title={tool.title} aria-label={tool.title} onMouseDown={(event) => { event.preventDefault(); tool.run(); }}>{tool.label}</button>)}
      <button type="button" className="markdown-mode" aria-pressed={source} onClick={toggleSource}>{source ? "Visual" : "Markdown"}</button>
    </div>
    {source
      ? <textarea className="description-editor" autoFocus value={markdown} onChange={(event) => setMarkdown(event.target.value)} aria-label={`${label} (Markdown)`} />
      : <div ref={editor} className="markdown-text markdown-editable" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={label}
        onPaste={(event) => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); }}
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onCancel(); } if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) onSave(current()); }} />}
    <div className="markdown-actions"><button type="button" className="primary-button" onClick={() => onSave(current())}>{saveLabel}</button><button type="button" onClick={onCancel}>Cancel</button></div>
  </div>;
}
