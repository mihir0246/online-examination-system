import mammoth from "mammoth";
import pdf from "pdf-parse/lib/pdf-parse.js";
import logger from "./logger.js";
import { z } from "zod";

// ─── Patterns for academic metadata and noise ────────────────────────────────

// Column headers often appear when tables are flattened
const HEADER_LINE_RE = /^(sr\.?\s*no\.?\s*|sr\s*|no\.?\s*)(questions?\s*|q\.\s*)(co\d*|marks?|po\d*|btl\d*|bloom|unit|module|lo\d*|\s*)*$/i;

// Noise-only line (metadata columns like CO1, PO2, 5 Marks)
const NOISE_ONLY_RE  = /^(co\d+|po\d+|btl\s*\d*|l[1-6]|marks?:?\s*\d*|\d{1,3}[\.\):]?|sr\.?\s*no\.?|questions?|bloom|unit\s*\d*|module\s*\d*|course\s*outcome\w*|program\s*outcome\w*)$/i;

const SUFFIX_PATTERNS = [
  /\bCO\d+\b/i, /\bPO\d+\b/i, /\bBTL\s?\d+\b/i,
  /\bL[1-6]\b/i, /\d{1,2}\s?[Mm]arks?\b/i,
  /\bC\.O\.\s?\d+\b/i, /\bP\.O\.\s?\d+\b/i
];

const hasSuffix = (text) =>
  SUFFIX_PATTERNS.some(p => p.test(text.slice(-30)));

// Signal for start of a new row (e.g., "1. What is...")
const ROW_START_RE = /^(\d{1,3})[\.\)\s]+\s*(.+)/;

// Option patterns for detecting MCQs inside table cells
const OPTION_RE = /^\(([A-D1-4])\)\s*(.+)$|^(?:[A-D1-4])[):.]\s*(.+)$/i;

const outputSchema = z.array(z.object({
  body: z.string().min(1),
  type: z.enum(["MCQ", "TEXT"]),
  options: z.array(z.object({
    optbody: z.string(),
    isAnswer: z.boolean()
  })),
  explanation: z.string(),
  difficulty: z.number().int().min(0).max(5)
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const cleanBody = (raw) => {
  if (!raw) return "";
  let body = raw
    .replace(/^\d{1,3}[\.\)\s]+/, '') // strip leading serial
    .replace(/\s{2,}/g, ' ')
    .trim();
    
  // strip trailing CO/PO/Marks
  if (hasSuffix(body)) {
    const last30 = body.slice(-30);
    const match = SUFFIX_PATTERNS.find(p => p.test(last30));
    if (match) {
      const matchText = last30.match(match)[0];
      body = body.substring(0, body.lastIndexOf(matchText)).trim();
      // Remove trailing punctuation that might have preceded the suffix
      body = body.replace(/[\.\?!]\s*$/, '').trim();
    }
  }
  return body;
};

const isLegitContent = (text) => {
  if (!text || text.length < 5) return false;
  if (NOISE_ONLY_RE.test(text)) return false;
  if (HEADER_LINE_RE.test(text)) return false;
  return true;
};

// ─── PARSERS ─────────────────────────────────────────────────────────────────

/**
 * Detects options within a question body or subsequent lines.
 * Useful for tables where MCQ options are pasted into the same cell or next lines.
 */
const extractOptionsFromText = (bodyText) => {
  const options = [];
  let cleanBody = bodyText;
  
  // Try to find options like (A) or A) or 1)
  const optionMarkers = bodyText.matchAll(/\s*(\(?([A-D1-4])[\).])\s*(.+?)(?=\s*\(?[A-D1-4][\).]| \w+[:\s]|$)/gi);
  const matches = [...optionMarkers];
  
  if (matches.length >= 2) {
    // Everything before the first option is the body
    const firstMatchIndex = matches[0].index;
    cleanBody = bodyText.substring(0, firstMatchIndex).trim();
    
    for (const match of matches) {
      options.push({ 
        optbody: match[3].trim(), 
        isAnswer: false 
      });
    }
  }

  return {
    cleanBody: cleanBody || bodyText,
    options
  };
};

const parseTableConcatenated = (lines) => {
  const questions = [];
  let buffer = '';
  let expectedNext = 1;

  const flush = () => {
    if (!buffer.trim()) return;
    
    let body = cleanBody(buffer);
    if (!isLegitContent(body)) {
      buffer = '';
      return;
    }

    const { cleanBody: finalBody, options } = extractOptionsFromText(body);
    
    questions.push({
      body: finalBody,
      type: options.length > 0 ? 'MCQ' : 'TEXT',
      options,
      explanation: 'Imported from document',
      difficulty: 0
    });
    
    buffer = '';
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Detect new row
    const startMatch = line.match(ROW_START_RE);
    if (startMatch) {
      const n = parseInt(startMatch[1]);
      // If it looks like a sequence, it's a new row
      if (n >= expectedNext && n <= expectedNext + 5) {
        flush();
        expectedNext = n + 1;
        buffer = line;
        continue;
      }
    }

    // Continuation
    if (!HEADER_LINE_RE.test(line) && !NOISE_ONLY_RE.test(line)) {
      buffer += ' ' + line;
    }

    // Flush if we see a clear suffix (end of row indicators)
    if (hasSuffix(line)) {
      flush();
    }
  }
  flush();
  return questions;
};

const parseQFormat = (text) => {
  const questions = [];
  // Split by "Q1:" or "Question 1:"
  const parts = text.split(/(?=\bQ\d*[:\s]|\bQuestion\s*\d*[:\s])/gi).slice(1);

  for (const part of parts) {
    const lines = part.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    if (lines.length === 0) continue;

    let body = lines[0].replace(/^(?:Q\d*|Question\s*\d*)[:\s]\s*/i, '').trim();
    const options = [];
    let exp = '';
    let answerIndex = -1;

    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      const optMatch = l.match(/^(?:[1-4]|[A-D])[):.]\s*(.*)/i) || l.match(/^\(([A-D1-4])\)\s*(.*)/i);
      if (optMatch) {
        options.push({ optbody: (optMatch[1].length > 1 ? optMatch[1] : optMatch[2] || optMatch[1]).trim(), isAnswer: false });
        continue;
      }
      
      const ansMatch = l.match(/^(?:Ans|Answer)[:\s]\s*([1-4]|[A-D])/i);
      if (ansMatch) {
        const val = ansMatch[1].toUpperCase();
        answerIndex = "ABCD".indexOf(val);
        if (answerIndex === -1) answerIndex = parseInt(val) - 1;
        continue;
      }

      const expMatch = l.match(/^(?:Exp|Explanation)[:\s]\s*(.*)/i);
      if (expMatch) { exp = expMatch[1]; continue; }
      
      // If not a metadata line, it's probably a body continuation
      if (options.length === 0 && !ansMatch && !expMatch) {
        body += " " + l;
      }
    }

    const finalBody = cleanBody(body);
    if (!isLegitContent(finalBody)) continue;

    if (answerIndex >= 0 && answerIndex < options.length) {
      options[answerIndex].isAnswer = true;
    }

    questions.push({
      body: finalBody,
      type: options.length > 0 ? 'MCQ' : 'TEXT',
      options,
      explanation: exp || 'Imported from document',
      difficulty: 0
    });
  }
  return questions;
};

// ─── DISPATCHER ──────────────────────────────────────────────────────────────

const parseTextToQuestions = (text) => {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);

  // 1. Check for Q: / Question: format
  if (/\bQ\d*\s*[:\s]|Question\s*\d*\s*[:\s]/i.test(text)) {
    const qResults = parseQFormat(text);
    if (qResults.length > 2) return qResults;
  }

  // 2. Check for Table-like format (flattened columns)
  const isTableLike = 
    lines.filter(l => ROW_START_RE.test(l)).length >= 3 ||
    lines.filter(l => /CO\d+|PO\d+|Marks/i.test(l)).length >= 3;

  if (isTableLike) {
    const tableResults = parseTableConcatenated(lines);
    if (tableResults.length > 0) return tableResults;
  }

  // 3. Fallback: Standard numbered list
  const numberedResults = [];
  let currentBuffer = "";
  for (const line of lines) {
    if (ROW_START_RE.test(line)) {
      if (currentBuffer) {
        const body = cleanBody(currentBuffer);
        if (isLegitContent(body)) {
          numberedResults.push({ body, type: "TEXT", options: [], explanation: "Imported", difficulty: 0 });
        }
      }
      currentBuffer = line;
    } else if (currentBuffer && !NOISE_ONLY_RE.test(line)) {
      currentBuffer += " " + line;
    }
  }
  if (currentBuffer) {
    const body = cleanBody(currentBuffer);
    if (isLegitContent(body)) numberedResults.push({ body, type: "TEXT", options: [], explanation: "Imported", difficulty: 0 });
  }

  if (numberedResults.length > 0) return numberedResults;

  // 4. Last resort: Extract any paragraph-like text as questions
  return lines
    .filter(l => isLegitContent(l) && l.length > 20)
    .map(l => ({
      body: cleanBody(l),
      type: "TEXT",
      options: [],
      explanation: "Imported from document",
      difficulty: 0
    }));
};

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

export const extractQuestionsFromFile = async (fileBuffer, mimeType) => {
  let text = '';
  try {
    if (mimeType === 'application/pdf') {
      const data = await pdf(fileBuffer);
      text = data.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      text = result.value;
    } else {
      text = fileBuffer.toString('utf-8');
    }

    if (!text || text.trim().length < 5) {
      throw new Error('No readable text found in file');
    }

    logger.info(`Parsing document text (${text.length} chars)`);
    const rawQuestions = parseTextToQuestions(text);
    
    // Validate with Zod for structural integrity
    const validated = outputSchema.parse(rawQuestions);
    logger.info(`Successfully parsed ${validated.length} questions`);
    
    return validated;
  } catch (err) {
    logger.error(`Parser error: ${err.message}`);
    throw new Error(`Failed to parse file: ${err.message}`);
  }
};
