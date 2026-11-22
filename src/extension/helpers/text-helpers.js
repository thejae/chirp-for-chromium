// Sentence segmentation comes from the platform's ICU rules, which the
// extension already relies on elsewhere (`Intl.Segmenter` for word timing and
// `Intl.DisplayNames` for language names); it replaces wink, whose English
// model alone cost 4.2 MB in the service worker bundle.
const sentenceSegmenter =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'sentence' })
    : null
const CJK_REGEX = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/
const MAX_SENTENCE_CHARS = 80
const MAX_CJK_SENTENCE_CHARS = 35

// Native marks carry prosody an ASCII full stop cannot: `？` rises at the end,
// `！` is emphatic, and `，` / `、` ask for a short beat without a word break.
// Keep them as written for every script the engine understands (CJK, Arabic,
// Devanagari, Ethiopic), not just for Chinese. Only synthesize a full stop
// when the author left the sentence unterminated.
const TERMINAL_PUNCTUATION = /[.!?。！？…；؟।።]$/
const CLAUSE_PUNCTUATION = /[，,、：:،]+$/
const CLAUSE_SPLIT = /(?<=[，,、：:،—])\s*/
// A run of terminal marks (`？！`, `?!`) finishes one sentence: only split
// after the whole run, and only when native text follows without a space.
const SENTENCE_BREAK =
  /(?<=[。！？；؟।።](?![。！？；؟।።]))\s*|(?<=[.!?](?![.!?]))\s+/

/**
 * Normalizes decorative CJK brackets and quotation symbols (such as 『』, 「」,
 * 【】, 《》, ⟪⟫) into ASCII period sentence breaks so Google Cloud TTS Chirp3
 * voices never fail with `Sentence starting with: "⟪..." is too long`.
 *
 * It deliberately leaves the author's punctuation alone: earlier versions
 * rewrote `。！？` to `.` and `，、：` to `, `, which flattened questions and
 * exclamations into statements and inserted a fake word break after every
 * comma. Neither rewrite is needed for the bracket-length error.
 */
function normalizeTextForTts(input) {
  return input
    .replace(/[『「【〖〔《〈⟪［｛“‘「]+/g, ' ')
    .replace(/[』」】〗〕》〉⟫］｝”’」]+/g, (match, offset, text) =>
      CJK_REGEX.test(text.slice(0, offset)) ? '。' : '. ',
    )
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Ensures a plain-text sentence ends with a terminal punctuation mark. Google
 * Cloud TTS Chirp3's sentence-length validator needs a full stop on chunks we
 * had to synthesize ourselves, but an author's native mark is kept exactly as
 * written (and a trailing clause comma is dropped rather than followed by a
 * synthesized full stop).
 */
function ensureTerminalPunctuation(sentence) {
  const trimmed = sentence.trim()
  if (!trimmed) return ''
  if (TERMINAL_PUNCTUATION.test(trimmed)) return trimmed
  const withoutTrailingComma = trimmed.replace(CLAUSE_PUNCTUATION, '').trim()
  if (!withoutTrailingComma) return ''
  if (TERMINAL_PUNCTUATION.test(withoutTrailingComma)) return withoutTrailingComma
  // A run with native ideographs gets a native full stop; an ASCII/latin run
  // keeps the ASCII full stop Chirp3's sentence validator expects.
  return CJK_REGEX.test(withoutTrailingComma)
    ? `${withoutTrailingComma}。`
    : `${withoutTrailingComma}.`
}

/**
 * Splits a single sentence into smaller clauses below `maxChars` so Google
 * Cloud TTS Chirp3 never throws "sentences that are too long".
 */
export function splitLongSentence(sentence) {
  const normalized = normalizeTextForTts(sentence)
  if (!normalized) return []

  // Split on native and ASCII sentence-final marks, including the ASCII
  // full stops introduced by bracket normalization (`「你好」`).
  const subSentences = normalized
    .split(SENTENCE_BREAK)
    .map((s) => s.trim())
    .filter(Boolean)

  const output = []

  for (const sub of subSentences) {
    const maxChars = CJK_REGEX.test(sub)
      ? MAX_CJK_SENTENCE_CHARS
      : MAX_SENTENCE_CHARS

    if (sub.length <= maxChars) {
      const terminated = ensureTerminalPunctuation(sub)
      if (terminated && terminated !== '.') output.push(terminated)
      continue
    }

    // Split by clause separators (commas, colons, enumeration commas, dashes)
    const clauses = sub.split(CLAUSE_SPLIT)
    let current = ''

    for (const clause of clauses) {
      if (!clause) continue
      if ((current + clause).length <= maxChars) {
        current += clause
      } else {
        if (current.trim()) {
          const terminated = ensureTerminalPunctuation(current)
          if (terminated && terminated !== '.') output.push(terminated)
        }
        // The accumulated piece is already pushed, so start the next one empty.
        current = ''
        if (clause.length <= maxChars) {
          current = clause
        } else {
          for (let i = 0; i < clause.length; i += maxChars) {
            const slice = clause.slice(i, i + maxChars)
            if (slice.length === maxChars) {
              const terminated = ensureTerminalPunctuation(slice)
              if (terminated && terminated !== '.') output.push(terminated)
            } else {
              current = slice
            }
          }
        }
      }
    }

    if (current.trim()) {
      const terminated = ensureTerminalPunctuation(current)
      if (terminated && terminated !== '.') output.push(terminated)
    }
  }

  return output
}

String.prototype.chunk = function () {
  if (this.isSSML()) return this.chunkSSML()

  const rawText = String(this)
  const linesAndCjkSentences = rawText
    .split(/\r?\n+|(?<=[。！？；!?])\s*/)
    .map((s) => s.trim())
    .filter(Boolean)

  const rawSentences = linesAndCjkSentences.flatMap((segment) => {
    const sentences = sentenceSegmenter
      ? Array.from(
          sentenceSegmenter.segment(segment),
          (part) => part.segment,
        )
      : segment.split(/(?<=[.!?])\s+/)
    const cleaned = sentences.map((sentence) => sentence.trim()).filter(Boolean)
    return cleaned.length ? cleaned : [segment]
  })

  return rawSentences.flatMap(splitLongSentence).filter(Boolean)
}

String.prototype.chunkSSML = function () {
  const maxChunkSize = 5000
  const speakStartTag = '<speak>'
  const speakEndTag = '</speak>'
  const chunks = []
  let currentChunk = ''

  const content = this.slice(speakStartTag.length, -speakEndTag.length)

  const regex = /(<[^>]*>|[^<]+)/g
  let match

  while ((match = regex.exec(content)) !== null) {
    const element = match[0]

    if (
      currentChunk.length + element.length >
      maxChunkSize - (speakStartTag.length + speakEndTag.length)
    ) {
      chunks.push(speakStartTag + currentChunk + speakEndTag)
      currentChunk = ''
    }

    currentChunk += element
  }

  if (currentChunk) {
    chunks.push(speakStartTag + currentChunk + speakEndTag)
  }

  return chunks
}

String.prototype.isSSML = function () {
  const trimmedText = this.trim()
  return trimmedText.startsWith('<speak>') && trimmedText.endsWith('</speak>')
}
