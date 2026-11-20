import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownText } from "../src/MarkdownText";
import type { Card } from "../src/model";

describe("MarkdownText", () => {
  it("renders formatting and safe links from imported notes", () => {
    const html = renderToStaticMarkup(
      <MarkdownText text={"## Heading\n\n**Important** and [link](https://example.org/notes)\n\n- first\n- second"} />,
    );
    expect(html).toContain("<h2>Heading</h2>");
    expect(html).toContain("<strong>Important</strong>");
    expect(html).toContain('href="https://example.org/notes" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain("<li>second</li>");
  });

  it("does not load remote images or render raw HTML and unsafe links", () => {
    const html = renderToStaticMarkup(
      <MarkdownText
        text={
          "![cover](https://example.org/secret.png)\n\n<script>alert(1)</script>\n\n[dangerous link](javascript:alert(1))"
        }
      />,
    );
    expect(html).toContain("Image: cover");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });

  it("renders imported card links as local actions and keeps other links external", () => {
    const card = { id: "local-card" } as Card;
    const html = renderToStaticMarkup(
      <MarkdownText
        text={"[card](https://trello.com/c/ABC123) and [document](https://example.org)"}
        localCardForUrl={(url) => (url.includes("ABC123") ? card : undefined)}
        onNavigateCard={() => {}}
      />,
    );
    expect(html).toContain('<button type="button" class="markdown-card-link">card</button>');
    expect(html).toContain('href="https://example.org"');
    expect(html).not.toContain('href="https://trello.com/c/ABC123"');
  });
});
