/**
 * MarkdownMessage — lightweight inline markdown renderer.
 *
 * Parses without any external library:
 *   - Fenced code blocks  ```lang\ncode```
 *   - # / ## / ### headings
 *   - > blockquotes
 *   - - / * unordered list items
 *   - **bold**, *italic*
 *   - `inline code`
 *   - Line breaks (blank lines → paragraph breaks)
 */

import { cn } from "@/lib/utils";
import React from "react";

interface Props {
  content: string;
  className?: string;
}

// ── Inline parser (bold / italic / inline-code) ─────────────────────────────

function parseInline(text: string): React.ReactNode[] {
  // We split on: **bold**, *italic*, `code`
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    if (match[2] !== undefined) {
      nodes.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      nodes.push(<em key={match.index}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      nodes.push(
        <code
          key={match.index}
          className="bg-muted px-1 rounded text-sm font-mono"
        >
          {match[4]}
        </code>,
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }

  return nodes;
}

// ── Block parser ─────────────────────────────────────────────────────────────

interface Block {
  type: "heading" | "blockquote" | "li" | "code" | "paragraph" | "blank";
  level?: number;       // for heading
  lang?: string;        // for code
  lines: string[];
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const codeFence = line.match(/^```(\w*)$/);
    if (codeFence) {
      const lang = codeFence[1] || "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing ```
      blocks.push({ type: "code", lang, lines: codeLines });
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      blocks.push({ type: "blank", lines: [] });
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        lines: [headingMatch[2]],
      });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [line.slice(2)];
      i++;
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "blockquote", lines: quoteLines });
      continue;
    }

    // List item
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, ""));
        i++;
      }
      blocks.push({ type: "li", lines: items });
      continue;
    }

    // Paragraph — accumulate until blank / heading / fence
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !lines[i].match(/^#{1,3}\s/) &&
      !/^[-*]\s/.test(lines[i]) &&
      !lines[i].startsWith("> ")
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", lines: paraLines });
  }

  return blocks;
}

// ── Block → React element ─────────────────────────────────────────────────────

function renderBlock(block: Block, idx: number): React.ReactNode {
  switch (block.type) {
    case "blank":
      return null;

    case "code":
      return (
        <pre
          key={idx}
          className="bg-muted rounded p-3 text-sm overflow-x-auto font-mono my-2"
        >
          <code>{block.lines.join("\n")}</code>
        </pre>
      );

    case "heading": {
      const text = block.lines[0] ?? "";
      const inlines = parseInline(text);
      if (block.level === 1)
        return (
          <h1 key={idx} className="text-base font-bold mt-3 mb-1">
            {inlines}
          </h1>
        );
      if (block.level === 2)
        return (
          <h2 key={idx} className="text-sm font-semibold mt-2.5 mb-1">
            {inlines}
          </h2>
        );
      return (
        <h3 key={idx} className="text-sm font-medium mt-2 mb-0.5">
          {inlines}
        </h3>
      );
    }

    case "blockquote":
      return (
        <blockquote
          key={idx}
          className="border-l-2 border-muted-foreground/40 pl-3 my-2 text-muted-foreground text-sm italic"
        >
          {block.lines.map((l, j) => (
            <p key={j}>{parseInline(l)}</p>
          ))}
        </blockquote>
      );

    case "li":
      return (
        <ul key={idx} className="list-disc list-inside my-1 space-y-0.5 text-sm">
          {block.lines.map((item, j) => (
            <li key={j}>{parseInline(item)}</li>
          ))}
        </ul>
      );

    case "paragraph":
      return (
        <p key={idx} className="text-sm leading-relaxed my-1">
          {block.lines.flatMap((line, j) => {
            const nodes = parseInline(line);
            return j < block.lines.length - 1
              ? [...nodes, <br key={`br-${j}`} />]
              : nodes;
          })}
        </p>
      );

    default:
      return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MarkdownMessage({ content, className }: Props) {
  const blocks = parseBlocks(content);
  return (
    <div className={cn("space-y-0.5", className)}>
      {blocks.map((block, idx) => renderBlock(block, idx))}
    </div>
  );
}
