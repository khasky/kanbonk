import { askText } from "./AskDialog";
import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { htmlToMarkdown, type MdNode } from "../lib/htmlToMarkdown";
import { type MessageKey, t } from "../i18n";
import { Button } from "./Button";
import { Icon } from "./Icon";

function markdownToHtml(text: string): string {
  return renderToStaticMarkup(
    <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]}>
      {text}
    </ReactMarkdown>,
  );
}

const run = (command: string, value?: string) => () => document.execCommand(command, false, value);

async function insertLink() {
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
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]!);

interface Tool {
  title: MessageKey;
  run: () => void;
  /** A line under the title in the "+" menu. */
  note?: MessageKey;
  icon?: ReactNode;
  shortcut?: string;
}

/** The dropdowns of the toolbar, as Trello groups them. */
const menus: Record<"text" | "more" | "lists" | "insert", Tool[]> = {
  text: [
    { title: "ui.normalText", run: run("formatBlock", "p") },
    { title: "ui.heading1", run: run("formatBlock", "h1") },
    { title: "ui.heading2", run: run("formatBlock", "h2") },
    { title: "ui.heading3", run: run("formatBlock", "h3") },
  ],
  more: [
    { title: "ui.strikethrough", run: run("strikeThrough") },
    {
      title: "ui.code",
      run: () =>
        document.execCommand(
          "insertHTML",
          false,
          `<code>${escapeHtml(window.getSelection()?.toString() ?? "") || "code"}</code>`,
        ),
    },
  ],
  lists: [
    { title: "ui.bulletedList", run: run("insertUnorderedList") },
    { title: "ui.numberedList", run: run("insertOrderedList") },
  ],
  insert: [
    {
      title: "ui.link",
      note: "ui.linkNote",
      icon: <Icon name="link" />,
      shortcut: "Ctrl+K",
      run: () => void insertLink(),
    },
    {
      title: "ui.codeSnippet",
      note: "ui.codeSnippetNote",
      icon: "</>",
      shortcut: "```",
      run: () =>
        document.execCommand(
          "insertHTML",
          false,
          `<pre><code>${escapeHtml(window.getSelection()?.toString() ?? "") || "code"}</code></pre><p><br></p>`,
        ),
    },
    { title: "ui.quote", note: "ui.quoteNote", icon: "❞", shortcut: ">", run: run("formatBlock", "blockquote") },
    { title: "ui.divider", note: "ui.dividerNote", icon: "—", shortcut: "---", run: run("insertHorizontalRule") },
  ],
};

const toolClass =
  "flex h-8 min-w-8 cursor-pointer items-center justify-center gap-0.5 rounded-sm border-0 bg-transparent px-1.5 text-[15px] text-ink-subtle hover:bg-surface-sunken aria-pressed:bg-brand-soft aria-pressed:text-brand aria-expanded:bg-brand-soft aria-expanded:text-brand";
const separator = <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />;

/**
 * Looks per place: `comment` writes a new comment (on the white activity panel), `comment-edit` edits a comment in
 * place and looks the same, set off from the author line.
 */
const looks = {
  default: { root: "" },
  comment: { root: "" },
  "comment-edit": { root: "mt-[5px]" },
};

/** A toolbar dropdown: a button with a chevron and its list of tools; `insert` is the "+" list with a search field. */
function ToolMenu({
  name,
  label,
  open,
  onOpen,
  children,
}: {
  name: keyof typeof menus;
  label: string;
  open: boolean;
  onOpen: (open: boolean) => void;
  children?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [place, setPlace] = useState({ top: 0, left: 0 });
  const insert = name === "insert";
  const width = insert ? Math.min(480, window.innerWidth - 16) : 192;
  const items = menus[name].filter((tool) => t(tool.title).toLowerCase().includes(query.trim().toLowerCase()));
  const choose = (tool: Tool) => {
    onOpen(false);
    tool.run();
  };
  return (
    <div className="relative">
      <button
        type="button"
        className={toolClass}
        aria-label={label}
        title={label}
        aria-expanded={open}
        onMouseDown={(event) => {
          event.preventDefault();
          const box = event.currentTarget.getBoundingClientRect();
          setPlace({ top: box.bottom + 4, left: Math.max(8, Math.min(box.left, window.innerWidth - width - 8)) });
          setQuery("");
          onOpen(!open);
        }}
      >
        {children}
        <Icon name="chevron-down" className="size-3.5" />
      </button>
      {open && (
        <div
          className="fixed z-50 grid rounded-lg bg-white py-1.5 shadow-[0_8px_12px_#091e4226,0_0_1px_#091e424f]"
          role="menu"
          aria-label={label}
          style={{ ...place, width }}
        >
          {insert && (
            <label className="mx-3 mt-1.5 mb-2 flex items-center gap-2 rounded-sm border-2 border-brand px-2.5 py-1.5">
              <Icon name="search" className="size-4 text-ink-subtle" />
              <input
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] outline-none"
                ref={(input) => input?.focus()}
                placeholder={t("ui.search")}
                aria-label={t("ui.search")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && items[0]) {
                    event.preventDefault();
                    choose(items[0]);
                  }
                }}
              />
            </label>
          )}
          {items.map((tool) => (
            <button
              key={tool.title}
              type="button"
              role="menuitem"
              className={`flex w-full cursor-pointer items-center gap-3 border-0 border-l-2 border-transparent bg-transparent text-left text-ink hover:border-brand hover:bg-brand-soft ${insert ? "px-4 py-2" : "px-3 py-1.5"}`}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(tool);
              }}
            >
              {tool.icon && (
                <span className="grid size-10 flex-none place-items-center rounded-sm border border-line font-semibold text-ink-subtle">
                  {tool.icon}
                </span>
              )}
              <span className="grid min-w-0 flex-1">
                <span>{t(tool.title)}</span>
                {tool.note && <small className="text-[13px] text-ink-subtle">{t(tool.note)}</small>}
              </span>
              {tool.shortcut && (
                <kbd className="rounded-sm bg-surface-sunken px-1.5 py-0.5 font-sans text-[12px] text-ink-subtle">
                  {tool.shortcut}
                </kbd>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * WYSIWYG editor that stores Markdown: edits rendered HTML, converts back on save; a source mode edits Markdown
 * directly. Its toolbar is Trello's: text styles, bold, italic and more formatting, lists and an "Insert" menu, then a
 * button to attach files when `onAttach` is given.
 */
export function MarkdownEditor({
  value,
  onSave,
  onCancel,
  onAttach,
  label,
  saveLabel = t("common.save"),
  look = "default",
}: {
  value: string;
  onSave: (markdown: string) => void;
  onCancel: () => void;
  onAttach?: (files: File[]) => void;
  label: string;
  saveLabel?: string;
  look?: keyof typeof looks;
}) {
  const style = looks[look];
  const editor = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState(false);
  const [markdown, setMarkdown] = useState(value);
  const [menu, setMenu] = useState<keyof typeof menus | null>(null);
  const [bold, setBold] = useState(false);

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

  useEffect(() => {
    const update = () => setBold(document.queryCommandState("bold"));
    const close = (event: MouseEvent) => {
      if (!(event.target as Element).closest("[role=menu], [aria-expanded]")) setMenu(null);
    };
    document.addEventListener("selectionchange", update);
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("selectionchange", update);
      document.removeEventListener("mousedown", close);
    };
  }, []);

  const current = () => (source || !editor.current ? markdown : htmlToMarkdown(editor.current as unknown as MdNode));
  const toggleSource = () => {
    setMarkdown(current());
    setSource(!source);
  };
  const menuProps = (name: keyof typeof menus) => ({
    name,
    open: menu === name,
    onOpen: (open: boolean) => setMenu(open ? name : null),
  });
  const command = (name: string) => (event: { preventDefault: () => void }) => {
    event.preventDefault();
    document.execCommand(name);
    setBold(document.queryCommandState("bold"));
  };

  return (
    <div className={style.root}>
      <div className="rounded-md border-2 border-brand bg-white">
        <div
          className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1.5"
          role="toolbar"
          aria-label={t("ui.formatting", { label })}
        >
          {!source && (
            <>
              <ToolMenu {...menuProps("text")} label={t("ui.textStyles")}>
                <span className="text-[16px]">Tt</span>
              </ToolMenu>
              {separator}
              <button
                type="button"
                className={`${toolClass} font-bold`}
                title={t("ui.bold")}
                aria-label={t("ui.bold")}
                aria-pressed={bold}
                onMouseDown={command("bold")}
              >
                B
              </button>
              <button
                type="button"
                className={`${toolClass} font-serif italic`}
                title={t("ui.italic")}
                aria-label={t("ui.italic")}
                onMouseDown={command("italic")}
              >
                I
              </button>
              <ToolMenu {...menuProps("more")} label={t("ui.moreFormatting")} />
              {separator}
              <ToolMenu {...menuProps("lists")} label={t("ui.lists")}>
                <span className="text-[17px] leading-none">⁝≡</span>
              </ToolMenu>
              {separator}
              <ToolMenu {...menuProps("insert")} label={t("ui.insert")}>
                <Icon name="plus" className="size-4.5" />
              </ToolMenu>
            </>
          )}
          <span className="ml-auto flex items-center gap-0.5">
            {onAttach && !source && (
              <label
                className={`${toolClass} has-focus-visible:outline-2 has-focus-visible:outline-brand`}
                title={t("ui.attachFile")}
              >
                <Icon name="clip" className="size-4.5" />
                <input
                  className="sr-only"
                  type="file"
                  multiple
                  aria-label={t("ui.attachFile")}
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    onAttach(files);
                  }}
                />
              </label>
            )}
            <button type="button" className={`${toolClass} text-[13px]`} aria-pressed={source} onClick={toggleSource}>
              {source ? t("ui.visual") : t("ui.markdown")}
            </button>
          </span>
        </div>
        {source ? (
          <textarea
            className="block min-h-40 w-full resize-y rounded-b-md border-0 bg-white p-3 leading-normal text-ink outline-none"
            ref={(area) => area?.focus()}
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            aria-label={t("ui.markdownSource", { label })}
          />
        ) : (
          <div
            ref={editor}
            className="markdown-text min-h-[88px] px-4 py-3 [outline:none]"
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
                if (menu) setMenu(null);
                else onCancel();
              }
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) onSave(current());
              if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void insertLink();
              }
            }}
          />
        )}
      </div>
      <div className="mt-2 flex gap-2">
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
