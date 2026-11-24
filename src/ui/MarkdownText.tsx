import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Card } from "../model";
import { t } from "../i18n";

const looks = {
  plain: "markdown-text",
  comment: "markdown-text rounded-[5px] bg-white px-[11px] py-[9px] shadow-tile-soft",
  summary: "markdown-text markdown-summary",
};

/**
 * Rendered Markdown; card links open the card in the app instead of a new tab. `look="comment"` is a comment bubble,
 * `look="summary"` has full-width compact tables.
 */
export function MarkdownText({
  text,
  look = "plain",
  localCardForUrl,
  onNavigateCard,
}: {
  text: string;
  look?: keyof typeof looks;
  localCardForUrl?: (url: string) => Card | undefined;
  onNavigateCard?: (card: Card) => void;
}) {
  return (
    <div className={looks[look]}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const card = href && localCardForUrl?.(href);
            if (card && onNavigateCard)
              return (
                <button type="button" className="markdown-card-link" onClick={() => onNavigateCard(card)}>
                  {children}
                </button>
              );
            return href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              children
            );
          },
          img: ({ alt, src }) => (
            <span className="text-ink-subtle italic">{t("ui.image", { name: alt || src || t("ui.untitled") })}</span>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
