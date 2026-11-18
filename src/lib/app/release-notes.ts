/*
 * Release notes arrive as Markdown from the release (GitHub's generated
 * notes, or whatever was written). They're untrusted text, so instead of
 * rendering HTML they're parsed into this small tree, which React renders as
 * plain elements: headings, lists, paragraphs, bold, code and https links.
 * Anything else stays as text.
 */

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string; label: string };

export type Block =
  | { kind: "heading"; content: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "paragraph"; content: Inline[] };

const TOKEN =
  /`([^`]+)`|\*\*(.+?)\*\*|__(.+?)__|\[([^\]]+)\]\(([^)\s]+)\)|(https:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

/** A short label for a bare link: "#12" for a pull request, and so on. */
export const linkLabel = (href: string) => {
  try {
    const url = new URL(href);
    const path = url.pathname.replace(/\/$/, "");
    const github = url.hostname === "github.com";
    const pull = path.match(/\/(?:pull|issues)\/(\d+)$/);
    if (github && pull) return `#${pull[1]}`;
    const compare = path.match(/\/compare\/(.+)$/);
    if (github && compare) return compare[1].replace("...", "…");
    const label = `${url.hostname}${path}`;
    return label.length > 48 ? `${label.slice(0, 47)}…` : label;
  } catch {
    return href;
  }
};

const isSafeHref = (href: string) => {
  try {
    return new URL(href).protocol === "https:";
  } catch {
    return false;
  }
};

export const parseInline = (source: string): Inline[] => {
  const out: Inline[] = [];
  const text = (t: string) => {
    if (!t) return;
    const last = out.at(-1);
    if (last?.kind === "text") last.text += t;
    else out.push({ kind: "text", text: t });
  };
  let at = 0;
  for (const m of source.matchAll(TOKEN)) {
    text(source.slice(at, m.index));
    at = (m.index ?? 0) + m[0].length;
    const [, code, bold, bold2, linkText, linkHref, bare] = m;
    if (code !== undefined) out.push({ kind: "code", text: code });
    else if (bold !== undefined || bold2 !== undefined)
      out.push({ kind: "strong", children: parseInline(bold ?? bold2) });
    else if (linkText !== undefined) {
      if (isSafeHref(linkHref))
        out.push({ kind: "link", href: linkHref, label: linkText });
      else text(linkText);
    } else if (bare !== undefined)
      out.push({ kind: "link", href: bare, label: linkLabel(bare) });
  }
  text(source.slice(at));
  return out;
};

const HEADING = /^#{1,6}\s+(.*?)\s*#*$/;
const ITEM = /^\s*([-*+]|\d+[.)])\s+(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;

export const parseNotes = (markdown: string): Block[] => {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (paragraph.length) {
      blocks.push({
        kind: "paragraph",
        content: parseInline(paragraph.join(" ")),
      });
      paragraph = [];
    }
    if (list) {
      blocks.push({
        kind: "list",
        ordered: list.ordered,
        items: list.items.map(parseInline),
      });
      list = null;
    }
  };

  const source = markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\r\n?/g, "\n");
  for (const raw of source.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim() || RULE.test(line)) {
      flush();
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", content: parseInline(heading[1]) });
      continue;
    }
    const item = line.match(ITEM);
    if (item) {
      const ordered = /\d/.test(item[1]);
      if (paragraph.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push(item[2].trim());
      continue;
    }
    // An indented line carries on the list item above it.
    if (list && /^\s+/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (list) flush();
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
};
