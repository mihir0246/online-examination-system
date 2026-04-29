import mammoth from "mammoth";
import pdf from "pdf-parse/lib/pdf-parse.js";
import logger from "./logger.js";

// ─── Patterns for things that are NEVER question text ────────────────────────

// These column header combinations appear when pdf-parse concatenates table headers
const HEADER_LINE_RE = /^(sr\.?\s*no\.?\s*|sr\s*|no\.?\s*)(questions?\s*|q\.\s*)(co\d*|marks?|po\d*|btl\d*|bloom|unit|module|lo\d*|\s*)*$/i;

// Noise-only line (a line that contains ONLY metadata, not question text)
const NOISE_ONLY_RE  = /^(co\d+|po\d+|btl\s*\d*|l[1-6]|marks?:?\s*\d*|\d{1,3}[\.\):]?|sr\.?\s*no\.?|questions?|bloom|unit\s*\d*|module\s*\d*|course\s*outcome\w*|program\s*outcome\w*)$/i;

// Suffixes that appear AFTER question text in the concatenated row 
// (the "CO", "PO", "Marks", "BTL" columns pasted right after the question)
const SUFFIX_RE = /([\.\?!]?\s*)(CO\d+(\s*,\s*CO\d+)*|PO\d+(\s*,\s*PO\d+)*|C\.O\.\s*\d+|P\.O\.\s*\d+|BTL\s*\d+|L[1-6]|\d{1,2}\s*[Mm]arks?)\s*.*?$/;

// A line signals the START of a new table row:
// Must begin with a 1-3 digit number followed immediately by a capital letter
// (or number + optional space + capital letter). Requiring capital prevents
// matches on continuation lines that happen to start with a number mid-sentence.
const ROW_START_RE = /^(\d{1,3})\s*([A-Z][a-z].+)/;

// Some PDFs put the serial number on its own line (separate cell)
const BARE_SERIAL_RE = /^(\d{1,3})$/;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const cleanQuestion = (raw) => {
  let s = raw
    .replace(SUFFIX_RE, '') // strip trailing CO/PO/Marks columns
    .replace(/^\d{1,3}[\.\)\s]*/, '') // strip leading serial number
    .replace(/\s{2,}/g, ' ')
    .trim();
  return s;
};

const isWorthKeeping = (body) => {
  if (!body || body.length < 8) return false;
  if (NOISE_ONLY_RE.test(body)) return false;
  if (HEADER_LINE_RE.test(body)) return false;
  // Reject if body is just a number or short junk
  if (/^\d{1,3}$/.test(body)) return false;
  return true;
};

// ─── TABLE FORMAT PARSER ─────────────────────────────────────────────────────
// Handles PDFs extracted from tables where columns are concatenated per line.
// Example line: "1Define the term Non-relational DatabaseCO1"
//               "3Analyze the business drivers...over"     ← wrapped, no suffix yet
//               "traditional relational databases.CO1"      ← continuation with suffix

const parseTableConcatenated = (lines) => {
  const questions = [];
  let buffer = '';
  let expectedNext = 1;   // track expected serial number
  let pendingSerial = false; // true when we saw a bare serial number line

  const flush = () => {
    if (!buffer.trim()) return;
    const body = cleanQuestion(buffer);
    if (isWorthKeeping(body)) {
      questions.push({
        body,
        type: 'TEXT',
        options: [],
        explanation: 'Imported from document',
        difficulty: 0
      });
    }
    buffer = '';
    pendingSerial = false;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Skip pure header or noise-only lines
    if (HEADER_LINE_RE.test(line) || NOISE_ONLY_RE.test(line)) continue;

    // Case 1: bare serial number on its own line (PDF cell separate from question)
    if (BARE_SERIAL_RE.test(line)) {
      const n = parseInt(line);
      // Accept if it's plausibly sequential (within +5 of expected)
      if (n >= expectedNext && n <= expectedNext + 5) {
        flush();
        expectedNext = n + 1;
        pendingSerial = true;
      }
      continue;
    }

    // Case 2: serial number directly concatenated with question text: "1Define..."
    const startMatch = line.match(ROW_START_RE);
    if (startMatch) {
      const n = parseInt(startMatch[1]);
      // Accept if it's plausibly sequential
      if (n >= expectedNext - 1 && n <= expectedNext + 5) {
        flush();
        expectedNext = n + 1;
        buffer = line; // keep full line; cleanQuestion will strip the leading number
        pendingSerial = false;
        continue;
      }
    }

    // Case 3: continuation line OR first line after a bare serial
    if (pendingSerial) {
      // First text line after a bare serial number — start the question body
      buffer = line;
      pendingSerial = false;
    } else {
      buffer += ' ' + line;
    }

    // If current buffer ends with a known row-suffix, it's complete — flush
    if (buffer && SUFFIX_RE.test(buffer)) {
      flush();
    }
  }
  flush();
  return questions;
};

// ─── Q: / Question: FORMAT PARSER ────────────────────────────────────────────
const parseQFormat = (text) => {
  const questions = [];
  const parts = text.split(/(?=\bQ\d*[:\s]|\bQuestion\s*\d*[:\s])/gi).slice(1);

  for (const part of parts) {
    const lines = part.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    let body = lines[0].replace(/^(?:Q\d*|Question\s*\d*)[:\s]\s*/i, '').trim();
    body = cleanQuestion(body);
    if (!isWorthKeeping(body)) continue;

    const options = [];
    let ans = null, exp = '';
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      const opt = l.match(/^(?:[1-4]|[A-D])[):.]\s*(.*)/i);
      if (opt) { options.push({ optbody: opt[1], isAnswer: false }); continue; }
      const ansM = l.match(/^(?:Ans|Answer)[:\s]\s*([1-4]|[A-D])/i);
      if (ansM) {
        const v = ansM[1].toUpperCase();
        ans = v === 'A' ? 1 : v === 'B' ? 2 : v === 'C' ? 3 : v === 'D' ? 4 : parseInt(v);
        continue;
      }
      const expM = l.match(/^(?:Exp|Explanation)[:\s]\s*(.*)/i);
      if (expM) { exp = expM[1]; continue; }
    }
    if (ans && options[ans - 1]) options[ans - 1].isAnswer = true;
    questions.push({
      body, type: options.length > 0 ? 'MCQ' : 'TEXT',
      options, explanation: exp || 'Imported from document', difficulty: 0
    });
  }
  return questions;
};

// ─── DISPATCHER ──────────────────────────────────────────────────────────────
const parseTextToQuestions = (text) => {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);

  // Q: / Question: format
  if (/\bQ\d*\s*:|Question\s*\d*\s*:/i.test(text)) {
    const r = parseQFormat(text);
    if (r.length > 0) return r;
  }

  // Table / numbered format (the common exam paper format)
  // Signal: we see lines starting with a number followed immediately by text,
  // OR lines that contain CO/PO/Marks codes (column values).
  const tableLike =
    lines.filter(l => ROW_START_RE.test(l)).length >= 2 ||
    lines.filter(l => /CO\d+|PO\d+|BTL\s*\d+/i.test(l)).length >= 2;

  if (tableLike) {
    const r = parseTableConcatenated(lines);
    if (r.length > 0) return r;
  }

  // Plain numbered list fallback: "1. Question..." or "1) Question..."
  const numbered = [];
  let cur = '';
  for (const line of lines) {
    const m = line.match(/^\d{1,3}[\.\)]\s+(.+)/);
    if (m) {
      if (cur) {
        const body = cleanQuestion(cur);
        if (isWorthKeeping(body)) numbered.push({ body, type: 'TEXT', options: [], explanation: 'Imported', difficulty: 0 });
      }
      cur = m[1];
    } else if (cur && !NOISE_ONLY_RE.test(line)) {
      cur += ' ' + line;
    }
  }
  if (cur) {
    const body = cleanQuestion(cur);
    if (isWorthKeeping(body)) numbered.push({ body, type: 'TEXT', options: [], explanation: 'Imported', difficulty: 0 });
  }
  if (numbered.length > 0) return numbered;

  // Last-resort: any long enough non-noise line
  return lines
    .map(l => cleanQuestion(l))
    .filter(body => isWorthKeeping(body) && body.length >= 15)
    .map(body => ({ body, type: 'TEXT', options: [], explanation: 'Imported from document', difficulty: 0 }));
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
    if (!text || text.trim().length < 5) throw new Error('No readable text found in file');
    logger.info(`Parsing file (${text.length} chars)`);
    const questions = parseTextToQuestions(text);
    logger.info(`Extracted ${questions.length} questions`);
    return questions;
  } catch (err) {
    logger.error(`File extraction error: ${err.message}`);
    throw new Error(`Parse Error: ${err.message}`);
  }
};
