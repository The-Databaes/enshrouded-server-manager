import { describe, expect, it } from "vitest";

import { linkLabel, parseInline, parseNotes } from "@/lib/app/release-notes";

describe("parseNotes", () => {
  it("reads GitHub's generated notes", () => {
    const blocks = parseNotes(
      [
        "## What's Changed",
        "* feat(ui): panels by @someone in https://github.com/o/r/pull/12",
        "* fix: splash race in https://github.com/o/r/pull/13",
        "",
        "**Full Changelog**: https://github.com/o/r/compare/v0.1.0...v0.2.0",
      ].join("\r\n"),
    );
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "list", "paragraph"]);
    const list = blocks[1];
    expect(list.kind === "list" && list.items).toHaveLength(2);
    expect(list.kind === "list" && list.items[0].at(-1)).toEqual({
      kind: "link",
      href: "https://github.com/o/r/pull/12",
      label: "#12",
    });
  });

  it("joins wrapped lines into their paragraph or list item", () => {
    const blocks = parseNotes(
      "One line\nand the next.\n\n- item\n  carried on\n- two",
    );
    expect(blocks[0]).toEqual({
      kind: "paragraph",
      content: [{ kind: "text", text: "One line and the next." }],
    });
    expect(blocks[1].kind === "list" && blocks[1].items[0]).toEqual([
      { kind: "text", text: "item carried on" },
    ]);
  });

  it("separates ordered from unordered lists and drops comments and rules", () => {
    const blocks = parseNotes(
      "<!-- hidden -->\n1. first\n2. second\n- other\n\n---\n",
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: "list", ordered: true });
    expect(blocks[1]).toMatchObject({ kind: "list", ordered: false });
  });
});

describe("parseInline", () => {
  it("handles bold, code and links", () => {
    expect(
      parseInline("**Fast** `ctrl+k` [docs](https://example.com/a)"),
    ).toEqual([
      { kind: "strong", children: [{ kind: "text", text: "Fast" }] },
      { kind: "text", text: " " },
      { kind: "code", text: "ctrl+k" },
      { kind: "text", text: " " },
      { kind: "link", href: "https://example.com/a", label: "docs" },
    ]);
  });

  it("never links anything but https", () => {
    const nodes = parseInline(
      "[x](javascript:alert(1)) [y](http://plain.example) [z](data:text/html,hi)",
    );
    expect(nodes.every((n) => n.kind === "text")).toBe(true);
  });

  it("leaves trailing punctuation out of a bare link", () => {
    const [, link, rest] = parseInline("See https://example.com/notes.");
    expect(link).toMatchObject({
      kind: "link",
      href: "https://example.com/notes",
    });
    expect(rest).toEqual({ kind: "text", text: "." });
  });
});

describe("linkLabel", () => {
  it("shortens GitHub links", () => {
    expect(linkLabel("https://github.com/o/r/issues/7")).toBe("#7");
    expect(linkLabel("https://github.com/o/r/compare/v1...v2")).toBe("v1…v2");
    expect(linkLabel("https://example.com/")).toBe("example.com");
  });
});
