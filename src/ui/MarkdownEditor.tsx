import { useEffect, useEffectEvent, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { htmlToMarkdown, type MdNode } from "../lib/htmlToMarkdown";
import { Button } from "./Button";

function markdownToHtml(text: string): string {
  return renderToStaticMarkup(
    <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]}>
      {text}
    </ReactMarkdown>,
  );
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
  {
    label: "</>",
    title: "Code",
    run: () => {
      const text = window.getSelection()?.toString() ?? "";
      document.execCommand(
        "insertHTML",
        false,
        `<code>${text.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!) || "code"}</code>`,
      );
    },
  },
  {
    label: "🔗",
    title: "Link",
    run: () => {
      const url = prompt("Link URL (https://…)");
      if (url && /^(https?:|mailto:)/i.test(url.trim())) document.execCommand("createLink", false, url.trim());
    },
  },
  { label: "—", title: "Divider", run: () => document.execCommand("insertHorizontalRule") },
];

/**
 * Looks per place: `comment` writes a new comment (on the white activity panel), `comment-edit` edits a comment in
 * place and looks the same, set off from the author line.
 */
const looks = {
  default: {
    root: "overflow-hidden rounded-md border border-[#8590a2]",
    source: "bg-surface-sunken",
  },
  comment: {
    root: "overflow-hidden rounded-md border border-[#8590a2]",
    source: "bg-white",
  },
  "comment-edit": {
    root: "mt-[5px] overflow-hidden rounded-md border border-[#8590a2]",
    source: "bg-white",
  },
};

/** WYSIWYG editor that stores Markdown: edits rendered HTML, converts back on save; a source mode edits Markdown directly. */
export function MarkdownEditor({
  value,
  onSave,
  onCancel,
  label,
  saveLabel = "Save",
  look = "default",
}: {
  value: string;
  onSave: (markdown: string) => void;
  onCancel: () => void;
  label: string;
  saveLabel?: string;
  look?: keyof typeof looks;
}) {
  const style = looks[look];
  const toolClass =
    "min-w-[30px] cursor-pointer rounded-[3px] border-0 bg-transparent px-2 py-1 font-semibold text-ink hover:bg-line";
  const editor = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState(false);
  const [markdown, setMarkdown] = useState(value);

  // Re-render the visual editor only when switching modes; typing must not reset the caret.
  const showVisual = useEffectEvent(() => {
    if (editor.current) {
      editor.current.innerHTML = markdownToHtml(markdown);
      editor.current.focus();
    }
  });
  useEffect(() => {
    if (!source) showVisual();
  }, [source]);

  const current = () => (source || !editor.current ? markdown : htmlToMarkdown(editor.current as unknown as MdNode));
  const toggleSource = () => {
    setMarkdown(current());
    setSource(!source);
  };

  return (
    <div className={style.root}>
      <div
        className="flex flex-wrap gap-0.5 border-b border-line bg-surface-soft p-1"
        role="toolbar"
        aria-label={`Formatting: ${label}`}
      >
        {!source &&
          tools.map((tool) => (
            <button
              key={tool.title}
              type="button"
              className={toolClass}
              title={tool.title}
              aria-label={tool.title}
              onMouseDown={(event) => {
                event.preventDefault();
                tool.run();
              }}
            >
              {tool.label}
            </button>
          ))}
        <button type="button" className={`ml-auto ${toolClass}`} aria-pressed={source} onClick={toggleSource}>
          {source ? "Visual" : "Markdown"}
        </button>
      </div>
      {source ? (
        <textarea
          className={`min-h-40 w-full resize-y rounded-none border-0 p-2.5 leading-normal text-ink focus:border-brand focus:bg-white ${style.source}`}
          autoFocus
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          aria-label={`${label} (Markdown)`}
        />
      ) : (
        <div
          ref={editor}
          className="markdown-text min-h-[120px] px-3 py-2.5 [outline:none]"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={label}
          onPaste={(event) => {
            event.preventDefault();
            document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onCancel();
            }
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) onSave(current());
          }}
        />
      )}
      <div className="flex gap-2 border-t border-line p-2">
        <Button type="button" variant="primary" onClick={() => onSave(current())}>
          {saveLabel}
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
