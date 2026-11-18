import { cn } from "cn";
import { useMemo } from "react";

import { useUpdateActions } from "@/hooks/use-updater";
import { type Block, type Inline, parseNotes } from "@/lib/app/release-notes";

const Inlines = ({ nodes }: { nodes: Inline[] }) => {
  const { openUrl } = useUpdateActions();
  return nodes.map((node, i) => {
    const key = `${node.kind}-${i}`;
    switch (node.kind) {
      case "text":
        return <span key={key}>{node.text}</span>;
      case "strong":
        return (
          <strong key={key} className="font-semibold text-foreground">
            <Inlines nodes={node.children} />
          </strong>
        );
      case "code":
        return (
          <code
            key={key}
            className="rounded bg-foreground/[0.07] px-1 py-px font-mono text-[0.8em] text-foreground"
          >
            {node.text}
          </code>
        );
      case "link":
        return (
          <a
            key={key}
            href={node.href}
            title={node.href}
            onClick={(e) => {
              // Opened in the browser, never inside the app's window.
              e.preventDefault();
              openUrl(node.href);
            }}
            className="font-medium text-shroud underline decoration-shroud/35 underline-offset-2 transition-colors hover:decoration-shroud focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
          >
            {node.label}
          </a>
        );
    }
    return null;
  });
};

/** Notes usually open with "What's Changed" (GitHub's) or "What's new":
 * the dialog already says that. */
const withoutLeadingTitle = (blocks: Block[]) => {
  const [first] = blocks;
  const text =
    first?.kind === "heading" && first.content.length === 1 && first.content[0].kind === "text"
      ? first.content[0].text
      : "";
  return /^what['’]?s (new|changed)\??$/i.test(text.trim()) ? blocks.slice(1) : blocks;
};

/** A release's notes, from untrusted Markdown, as plain elements. */
export const ReleaseNotes = ({
  markdown,
  className,
}: {
  markdown: string;
  className?: string;
}) => {
  const blocks = useMemo(() => withoutLeadingTitle(parseNotes(markdown)), [markdown]);
  return (
    <div
      className={cn(
        "space-y-3 text-sm leading-relaxed text-pretty text-muted-foreground",
        className,
      )}
    >
      {blocks.map((block, i) => {
        const key = `${block.kind}-${i}`;
        if (block.kind === "heading") {
          return (
            <h4
              key={key}
              className="pt-1 text-[0.8125rem] font-semibold text-foreground first:pt-0"
            >
              <Inlines nodes={block.content} />
            </h4>
          );
        }
        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={key}
              className={cn(
                "space-y-1.5",
                block.ordered &&
                  "list-decimal pl-5 marker:text-muted-foreground",
              )}
            >
              {block.items.map((item, j) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: notes never reorder
                  key={j}
                  className={cn(
                    block.ordered
                      ? "pl-1"
                      : "relative pl-4 before:absolute before:top-[0.6em] before:left-0.5 before:size-1.5 before:rotate-45 before:rounded-[1px] before:bg-ember/70",
                  )}
                >
                  <Inlines nodes={item} />
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={key}>
            <Inlines nodes={block.content} />
          </p>
        );
      })}
    </div>
  );
};
