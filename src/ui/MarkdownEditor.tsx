import { askText } from "./AskDialog";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { htmlToMarkdown, type MdNode } from "../lib/htmlToMarkdown";
import { type MessageKey, t } from "../i18n";
import { Button } from "./Button";

function markdownToHtml(text: string): string {
  return renderToStaticMarkup(
    <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]}>
      {text}
    </ReactMarkdown>,
  );
}

const tools: Array<{ label: string; title: MessageKey; run: () => void }> = [
  { label: "B", title: "ui.bold", run: () => document.execCommand("bold") },
  { label: "I", title: "ui.italic", run: () => document.execCommand("italic") },
  { label: "S", title: "ui.strikethrough", run: () => document.execCommand("strikeThrough") },
  { label: "H1", title: "ui.heading1", run: () => document.execCommand("formatBlock", false, "h1") },
  { label: "H2", title: "ui.heading2", run: () => document.execCommand("formatBlock", false, "h2") },
  { label: "H3", title: "ui.heading3", run: () => document.execCommand("formatBlock", false, "h3") },
  { label: "¶", title: "ui.normalText", run: () => document.execCommand("formatBlock", false, "p") },
  { label: "•", title: "ui.bulletedList", run: () => document.execCommand("insertUnorderedList") },
  { label: "1.", title: "ui.numberedList", run: () => document.execCommand("insertOrderedList") },
  { label: "❝", title: "ui.quote", run: () => document.execCommand("formatBlock", false, "blockquote") },
  {
    label: "</>",
    title: "ui.code",
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
    title: "ui.link",
    run: async () => {
      // The question takes the focus, so the selected text is remembered and selected again for the link.
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : undefined;
      const url = await askText({
        title: t("ui.addLink"),
        label: t("ui.linkUrl"),
        placeholder: "https://…",
        confirm: t("common.add"),
      });
      if (!url || !/^(https?:|mailto:)/i.test(url.trim()) || !range) return;
      (range.commonAncestorContainer.parentElement?.closest("[contenteditable]") as HTMLElement | null)?.focus();
      selection?.removeAllRanges();
      selection?.addRange(range);
      document.execCommand("createLink", false, url.trim());
    },
  },
  { label: "—", title: "ui.divider", run: () => document.execCommand("insertHorizontalRule") },
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
  saveLabel = t("common.save"),
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
        aria-label={t("ui.formatting", { label })}
      >
        {!source &&
          tools.map((tool) => (
            <button
              key={tool.title}
              type="button"
              className={toolClass}
              title={t(tool.title)}
              aria-label={t(tool.title)}
              onMouseDown={(event) => {
                event.preventDefault();
                tool.run();
              }}
            >
              {tool.label}
            </button>
          ))}
        <button type="button" className={`ml-auto ${toolClass}`} aria-pressed={source} onClick={toggleSource}>
          {source ? t("ui.visual") : t("ui.markdown")}
        </button>
      </div>
      {source ? (
        <textarea
          className={`min-h-40 w-full resize-y rounded-none border-0 p-2.5 leading-normal text-ink focus:border-brand focus:bg-white ${style.source}`}
          autoFocus
          value={markdown}
          onChange={(event) => setMarkdown(event.target.value)}
          aria-label={t("ui.markdownSource", { label })}
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
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
