import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Card } from "./model";

export function MarkdownText({ text, localCardForUrl, onNavigateCard }: { text: string; localCardForUrl?: (url: string) => Card | undefined; onNavigateCard?: (card: Card) => void }) {
  return <div className="markdown-text"><ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} components={{
    a: ({ href, children }) => {
      const card = href && localCardForUrl?.(href);
      if (card && onNavigateCard) return <button type="button" className="markdown-card-link" onClick={() => onNavigateCard(card)}>{children}</button>;
      return href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <>{children}</>;
    },
    img: ({ alt, src }) => <span className="markdown-image">Image: {alt || src || "untitled"}</span>,
  }}>{text}</ReactMarkdown></div>;
}
