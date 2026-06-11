import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

export interface ExtractedText {
  content: string;
  format: 'markdown' | 'text' | 'json' | 'html' | 'pdf' | 'docx' | 'xlsx';
}

const SUPPORTED_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.html', '.htm',
  '.pdf', '.docx', '.xlsx', '.xls',
]);

export function isSupportedForLocalExtraction(filePathOrName: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePathOrName).toLowerCase());
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function jsonToText(jsonText: string): string {
  try {
    const parsed = JSON.parse(jsonText);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return jsonText;
  }
}

function safeDecodeURIComponent(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

async function extractPdf(filePath: string): Promise<string> {
  const PDFParser = (await import('pdf2json')).default;
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();
    pdfParser.on('pdfParser_dataError', (err: any) => reject(new Error(err.parserError)));
    pdfParser.on('pdfParser_dataReady', (data: any) => {
      const pages: string[] = [];
      for (const page of (data.Pages || [])) {
        const lines: string[] = [];
        let currentY = -1;
        let currentLine = '';
        for (const text of (page.Texts || [])) {
          const decoded = (text.R || []).map((r: any) => safeDecodeURIComponent(r.T || '')).join('');
          const y = Math.round(text.y * 10) / 10;
          if (currentY === -1) {
            currentY = y;
          }
          if (Math.abs(y - currentY) > 0.3) {
            if (currentLine.trim()) lines.push(currentLine.trim());
            currentLine = '';
            currentY = y;
          }
          currentLine += decoded;
        }
        if (currentLine.trim()) lines.push(currentLine.trim());
        pages.push(lines.join('\n'));
      }
      resolve(pages.join('\n\n'));
    });
    pdfParser.loadPDF(filePath);
  });
}

async function extractDocx(filePath: string): Promise<string> {
  const mammoth = await import('mammoth');
  const buffer = await readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractXlsx(filePath: string): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.readFile(filePath);
  const allText: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) {
      allText.push(`[Sheet: ${sheetName}]`);
      allText.push(csv);
      allText.push('');
    }
  }

  return allText.join('\n');
}

export async function extractTextFromFile(filePath: string, fileName?: string): Promise<ExtractedText> {
  const extension = extname(fileName || filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(`Local text extraction is not supported for ${extension || 'unknown file type'}`);
  }

  // PDF
  if (extension === '.pdf') {
    const text = await extractPdf(filePath);
    return { content: normalizeWhitespace(text), format: 'pdf' };
  }

  // Word
  if (extension === '.docx') {
    const text = await extractDocx(filePath);
    return { content: normalizeWhitespace(text), format: 'docx' };
  }

  // Excel
  if (extension === '.xlsx' || extension === '.xls') {
    const text = await extractXlsx(filePath);
    return { content: normalizeWhitespace(text), format: 'xlsx' };
  }

  // Text-based formats (original logic)
  const raw = await readFile(filePath, 'utf8');

  if (extension === '.json') {
    return { content: normalizeWhitespace(jsonToText(raw)), format: 'json' };
  }

  if (extension === '.html' || extension === '.htm') {
    return { content: normalizeWhitespace(stripHtml(raw)), format: 'html' };
  }

  return {
    content: normalizeWhitespace(raw),
    format: extension === '.md' ? 'markdown' : 'text',
  };
}
