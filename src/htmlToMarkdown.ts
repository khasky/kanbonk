/** Minimal DOM node shape so the converter runs on browser nodes and on test fixtures. */
export interface MdNode {
  nodeType: number;
  nodeName: string;
  textContent: string | null;
  childNodes: ArrayLike<MdNode>;
  getAttribute?: (name: string) => string | null;
}

const blockTags = new Set([
  "P",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "PRE",
  "HR",
  "TABLE",
]);

function escapeText(text: string): string {
  return text.replace(/([\\`*_[\]])/g, "\\$1").replace(/^(\s*)([#>+-]|\d+\.)(\s)/gm, "$1\\$2$3");
}

function children(node: MdNode): MdNode[] {
  return Array.from(node.childNodes);
}

function inline(node: MdNode): string {
  if (node.nodeType === 3) return escapeText((node.textContent ?? "").replace(/\s+/g, " "));
  if (node.nodeType !== 1) return "";
  const content = () => children(node).map(inline).join("");
  const wrap = (mark: string) => {
    const text = content();
    const trimmed = text.trim();
    if (!trimmed) return text;
    return text.replace(trimmed, `${mark}${trimmed}${mark}`);
  };
  switch (node.nodeName) {
    case "STRONG":
    case "B":
      return wrap("**");
    case "EM":
    case "I":
      return wrap("_");
    case "DEL":
    case "S":
    case "STRIKE":
      return wrap("~~");
    case "CODE": {
      const text = node.textContent ?? "";
      const fence = text.includes("`") ? "``" : "`";
      return `${fence}${text}${fence}`;
    }
    case "BR":
      return "  \n";
    case "A": {
      const href = node.getAttribute?.("href") ?? "";
      const text = content();
      return href ? `[${text || href}](${href.replace(/\)/g, "%29")})` : text;
    }
    case "IMG":
      return `![${node.getAttribute?.("alt") ?? ""}](${node.getAttribute?.("src") ?? ""})`;
    case "INPUT":
      return "";
    default:
      return blockTags.has(node.nodeName) ? block(node, "").trim() : content();
  }
}

function list(node: MdNode, indent: string, ordered: boolean): string {
  let index = Number(node.getAttribute?.("start") ?? 1) || 1;
  return children(node)
    .filter((child) => child.nodeName === "LI")
    .map((item) => {
      const checkbox = children(item).find((child) => child.nodeName === "INPUT");
      const task = checkbox
        ? checkbox.getAttribute?.("checked") !== null && checkbox.getAttribute?.("checked") !== undefined
          ? "[x] "
          : "[ ] "
        : "";
      const marker = ordered ? `${index++}. ` : "- ";
      const inner = children(item);
      const text = inner
        .filter((child) => child.nodeName !== "UL" && child.nodeName !== "OL")
        .map((child) => (child.nodeName === "P" ? children(child).map(inline).join("") : inline(child)))
        .join("")
        .trim();
      const nested = inner
        .filter((child) => child.nodeName === "UL" || child.nodeName === "OL")
        .map((child) => list(child, `${indent}  `, child.nodeName === "OL"))
        .join("");
      return `${indent}${marker}${task}${text}\n${nested}`;
    })
    .join("");
}

function block(node: MdNode, indent: string): string {
  if (node.nodeType === 3) return inline(node);
  switch (node.nodeName) {
    case "H1":
    case "H2":
    case "H3":
    case "H4":
    case "H5":
    case "H6":
      return `${"#".repeat(Number(node.nodeName[1]))} ${children(node).map(inline).join("").trim()}\n\n`;
    case "P":
      return `${children(node).map(inline).join("").trim()}\n\n`;
    case "UL":
    case "OL":
      return `${list(node, indent, node.nodeName === "OL")}\n`;
    case "BLOCKQUOTE":
      return `${blocks(node)
        .trim()
        .split("\n")
        .map((line) => `> ${line}`.trimEnd())
        .join("\n")}\n\n`;
    case "PRE":
      return `\`\`\`\n${(node.textContent ?? "").replace(/\n$/, "")}\n\`\`\`\n\n`;
    case "HR":
      return "---\n\n";
    case "TABLE": {
      const rows: string[][] = [];
      const collect = (current: MdNode) => {
        for (const child of children(current)) {
          if (child.nodeName === "TR")
            rows.push(
              children(child)
                .filter((cell) => cell.nodeName === "TD" || cell.nodeName === "TH")
                .map((cell) => children(cell).map(inline).join("").trim().replace(/\|/g, "\\|")),
            );
          else collect(child);
        }
      };
      collect(node);
      if (!rows.length) return "";
      const width = Math.max(...rows.map((row) => row.length));
      const line = (row: string[]) =>
        `| ${Array.from({ length: width }, (_, index) => row[index] ?? "").join(" | ")} |`;
      return `${[line(rows[0]), `| ${Array(width).fill("---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n")}\n\n`;
    }
    case "DIV":
    case "BODY":
    case "SECTION":
    case "ARTICLE":
      return blocks(node);
    default:
      return inline(node);
  }
}

/** Converts block-level children; consecutive inline nodes become one paragraph. */
function blocks(node: MdNode): string {
  let output = "";
  let paragraph = "";
  const flush = () => {
    if (paragraph.trim()) output += `${paragraph.trim()}\n\n`;
    paragraph = "";
  };
  for (const child of children(node)) {
    if (child.nodeType === 1 && blockTags.has(child.nodeName)) {
      flush();
      output += block(child, "");
    } else paragraph += inline(child);
  }
  flush();
  return output;
}

export function htmlToMarkdown(root: MdNode): string {
  return blocks(root)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
