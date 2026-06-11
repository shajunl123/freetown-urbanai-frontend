export interface TextChunk {
  content: string;
  chunkIndex: number;
  section?: string;
  charStart: number;
  charEnd: number;
  tokenEstimate: number;
}

const TARGET_CHARS = 1200;
const OVERLAP_CHARS = 160;

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.25);
}

function sectionForOffset(text: string, offset: number): string | undefined {
  const headings = Array.from(text.matchAll(/^#{1,4}\s+(.+)$/gm)).filter(
    (match) => (match.index ?? 0) <= offset
  );
  const last = headings.at(-1)?.[1]?.trim();
  return last || undefined;
}

function findBoundary(text: string, start: number, targetEnd: number): number {
  if (targetEnd >= text.length) return text.length;

  const window = text.slice(start, targetEnd);
  const paragraphBreak = window.lastIndexOf('\n\n');
  if (paragraphBreak > TARGET_CHARS * 0.55) return start + paragraphBreak;

  const sentenceBreak = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('? '),
    window.lastIndexOf('! ')
  );
  if (sentenceBreak > TARGET_CHARS * 0.55) return start + sentenceBreak + 1;

  const space = window.lastIndexOf(' ');
  if (space > TARGET_CHARS * 0.55) return start + space;

  return targetEnd;
}

export function chunkText(text: string): TextChunk[] {
  const normalized = text.trim();
  if (!normalized) return [];

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < normalized.length) {
    const targetEnd = Math.min(start + TARGET_CHARS, normalized.length);
    const end = findBoundary(normalized, start, targetEnd);
    const content = normalized.slice(start, end).trim();

    if (content) {
      chunks.push({
        content,
        chunkIndex: chunks.length,
        section: sectionForOffset(normalized, start),
        charStart: start,
        charEnd: end,
        tokenEstimate: estimateTokens(content),
      });
    }

    if (end >= normalized.length) break;
    start = Math.max(end - OVERLAP_CHARS, start + 1);
  }

  return chunks;
}
