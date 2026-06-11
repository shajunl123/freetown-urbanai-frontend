export interface TextChunk {
  content: string;
  chunkIndex: number;
  section?: string;
  charStart: number;
  charEnd: number;
  tokenEstimate: number;
}

interface TextBlock {
  text: string;
  type: 'heading' | 'paragraph' | 'table_row' | 'line';
  section?: string;
  start: number;
  end: number;
}

const MIN_CHARS = 800;
const TARGET_CHARS = 1200;
const MAX_CHARS = 1500;
const OVERLAP_CHARS = 200;

function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.25);
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function isMarkdownHeading(line: string): boolean {
  return /^#{1,6}\s+\S+/.test(line.trim());
}

function headingTitle(line: string): string {
  return line.replace(/^#{1,6}\s+/, '').trim();
}

function isLikelyTableRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^\|?.+\|.+\|?$/.test(trimmed)) return true;
  if (/^[\s|:-]+$/.test(trimmed) && trimmed.includes('|')) return true;
  if (trimmed.includes('\t')) return true;
  if (/^([^,\n]+,){2,}[^,\n]+$/.test(trimmed)) return true;
  return /\S+\s{2,}\S+\s{2,}\S+/.test(trimmed);
}

function splitOversizedBlock(block: TextBlock): TextBlock[] {
  if (block.text.length <= MAX_CHARS) return [block];

  const parts: TextBlock[] = [];
  let localStart = 0;

  while (localStart < block.text.length) {
    const targetEnd = Math.min(localStart + TARGET_CHARS, block.text.length);
    const window = block.text.slice(localStart, targetEnd);
    const sentenceBreak = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('? '),
      window.lastIndexOf('! '),
      window.lastIndexOf('\n')
    );
    const localEnd =
      sentenceBreak > MIN_CHARS * 0.5 ? localStart + sentenceBreak + 1 : targetEnd;
    const text = block.text.slice(localStart, localEnd).trim();

    if (text) {
      parts.push({
        ...block,
        text,
        start: block.start + localStart,
        end: block.start + localEnd,
      });
    }

    if (localEnd >= block.text.length) break;
    localStart = Math.max(localEnd - OVERLAP_CHARS, localStart + 1);
  }

  return parts;
}

function parseBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  const lines = text.split('\n');
  let offset = 0;
  let currentParagraph: string[] = [];
  let paragraphStart = 0;
  let currentSection: string | undefined;

  function flushParagraph(endOffset: number): void {
    const content = currentParagraph.join('\n').trim();
    if (content) {
      blocks.push({
        text: content,
        type: 'paragraph',
        section: currentSection,
        start: paragraphStart,
        end: endOffset,
      });
    }
    currentParagraph = [];
  }

  for (const line of lines) {
    const lineStart = offset;
    const lineEnd = lineStart + line.length;
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph(lineStart);
      offset = lineEnd + 1;
      continue;
    }

    if (isMarkdownHeading(trimmed)) {
      flushParagraph(lineStart);
      currentSection = headingTitle(trimmed);
      blocks.push({
        text: trimmed,
        type: 'heading',
        section: currentSection,
        start: lineStart,
        end: lineEnd,
      });
    } else if (isLikelyTableRow(line)) {
      flushParagraph(lineStart);
      blocks.push({
        text: trimmed,
        type: 'table_row',
        section: currentSection,
        start: lineStart,
        end: lineEnd,
      });
    } else if (currentParagraph.length === 0) {
      currentParagraph = [trimmed];
      paragraphStart = lineStart;
    } else {
      currentParagraph.push(trimmed);
    }

    offset = lineEnd + 1;
  }

  flushParagraph(text.length);
  return blocks.flatMap(splitOversizedBlock);
}

function overlapPrefix(text: string): string {
  if (text.length <= OVERLAP_CHARS) return text;
  const prefix = text.slice(-OVERLAP_CHARS);
  const candidates = [prefix.indexOf('. '), prefix.indexOf('\n'), prefix.indexOf(' ')]
    .filter((index) => index >= 0);
  const boundary = candidates.length > 0 ? Math.min(...candidates) : -1;
  return boundary >= 0 ? prefix.slice(boundary).trim() : prefix.trim();
}

function blockSeparator(previous: TextBlock | undefined, next: TextBlock): string {
  if (!previous) return '';
  if (previous.type === 'table_row' && next.type === 'table_row') return '\n';
  if (next.type === 'table_row') return '\n';
  return '\n\n';
}

export function chunkText(text: string): TextChunk[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const blocks = parseBlocks(normalized);
  const chunks: TextChunk[] = [];
  let activeBlocks: TextBlock[] = [];
  let activeText = '';
  let activeStart = 0;
  let activeSection: string | undefined;

  function flush(force = false): void {
    const content = activeText.trim();
    if (!content) return;
    if (!force && content.length < MIN_CHARS && activeBlocks.length > 0) return;

    const lastBlock = activeBlocks.at(-1);
    chunks.push({
      content,
      chunkIndex: chunks.length,
      section: activeSection,
      charStart: activeStart,
      charEnd: lastBlock?.end ?? activeStart + content.length,
      tokenEstimate: estimateTokens(content),
    });

    const overlap = overlapPrefix(content);
    activeBlocks = [];
    activeText = overlap ? `${overlap}\n\n` : '';
    activeStart = lastBlock ? Math.max(lastBlock.end - OVERLAP_CHARS, 0) : activeStart;
  }

  for (const block of blocks) {
    const separator = blockSeparator(activeBlocks.at(-1), block);
    const candidate = `${activeText}${separator}${block.text}`.trim();

    if (!activeText.trim()) {
      activeStart = block.start;
      activeSection = block.section;
    }

    const shouldFlush =
      activeText.trim().length >= MIN_CHARS &&
      (candidate.length > MAX_CHARS || block.type === 'heading');

    if (shouldFlush) {
      flush(true);
      activeSection = block.section;
    }

    const nextSeparator = blockSeparator(activeBlocks.at(-1), block);
    activeText = `${activeText}${nextSeparator}${block.text}`.trim();
    activeBlocks.push(block);
    activeSection = activeSection ?? block.section;

    if (activeText.length >= TARGET_CHARS && block.type !== 'heading') {
      flush(activeText.length >= MIN_CHARS);
    }
  }

  flush(true);

  return chunks.map((chunk, index) => ({
    ...chunk,
    chunkIndex: index,
  }));
}
