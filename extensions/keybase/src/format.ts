/**
 * Convert standard Markdown to Keybase formatting dialect.
 *
 * Keybase uses its own formatting syntax:
 *   bold:          *text*
 *   italic:        _text_
 *   code (inline): `text`
 *   code (block):  ```text```
 *   strikethrough: ~~text~~
 *   quote:         > text
 *
 * Standard Markdown differences handled here:
 *   **bold** / __bold__   → *bold*
 *   *italic* (single *)   → _italic_
 *   # Heading             → strip #, keep text
 *   | tables |            → convert to bullet list
 *   [text](url)           → text (url)
 */

/** Placeholder tokens used during conversion to protect code spans. */
const FENCE_PLACEHOLDER = "\x00FENCE";
const INLINE_CODE_PLACEHOLDER = "\x00CODE";

/**
 * Convert standard Markdown to Keybase formatting dialect.
 *
 * Order of operations:
 * 1. Protect fenced code blocks (already compatible)
 * 2. Protect inline code (already compatible)
 * 3. Strip markdown headers (# Heading → Heading)
 * 4. Convert **bold** / __bold__ → *bold*
 * 5. Convert *italic* (single asterisk) → _italic_
 * 6. Convert [text](url) → text (url)
 * 7. Convert markdown tables to bullet lists
 * 8. Restore protected code spans
 */
export function markdownToKeybase(text: string): string {
  if (!text) return text;

  // 1. Protect fenced code blocks (already compatible)
  const fences: string[] = [];
  let result = text.replace(/```[\s\S]*?```/g, (match) => {
    fences.push(match);
    return `${FENCE_PLACEHOLDER}${fences.length - 1}`;
  });

  // 2. Protect inline code (already compatible)
  const inlineCodes: string[] = [];
  result = result.replace(/`[^`\n]+`/g, (match) => {
    inlineCodes.push(match);
    return `${INLINE_CODE_PLACEHOLDER}${inlineCodes.length - 1}`;
  });

  // 3. Strip markdown headers (# Heading → Heading)
  result = result.replace(/^#{1,6}\s+(.+)$/gm, "$1");

  // 4. Convert **bold** and __bold__ → *bold*
  result = result.replace(/\*\*(.+?)\*\*/gs, "*$1*");
  result = result.replace(/__(.+?)__/gs, "*$1*");

  // 5. Convert *italic* (single asterisk) → _italic_
  // Only match single * not adjacent to another * (double-star bold already converted above).
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/gs, "_$1_");

  // 6. Convert [text](url) → text (url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  // 7. Convert markdown tables to bullet lists
  result = convertMarkdownTablesToBullets(result);

  // 8. Restore protected spans
  result = result.replace(
    new RegExp(`${FENCE_PLACEHOLDER}(\\d+)`, "g"),
    (_, i) => fences[parseInt(i)] ?? "",
  );
  result = result.replace(
    new RegExp(`${INLINE_CODE_PLACEHOLDER}(\\d+)`, "g"),
    (_, i) => inlineCodes[parseInt(i)] ?? "",
  );

  return result;
}

function convertMarkdownTablesToBullets(text: string): string {
  // Match table blocks: header row, separator row, then body rows
  return text.replace(
    /^(\|.+\|\n)([ \t]*\|[ \t]*[-:]+[ \t]*(?:\|[ \t]*[-:]+[ \t]*)*\|[ \t]*\n)((?:\|.+\|\n?)*)/gm,
    (_, headerRow: string, _sep: string, bodyRows: string) => {
      const headers = headerRow
        .split("|")
        .slice(1, -1)
        .map((h: string) => h.trim());
      const rows = bodyRows.trim().split("\n").filter(Boolean);
      const bullets = rows.map((row: string) => {
        const cells = row
          .split("|")
          .slice(1, -1)
          .map((c: string) => c.trim());
        return (
          "- " +
          cells.map((c: string, i: number) => (headers[i] ? `${headers[i]}: ${c}` : c)).join(", ")
        );
      });
      return bullets.join("\n") + "\n";
    },
  );
}
