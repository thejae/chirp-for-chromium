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

// Google expects one complete <speak> document in `input.ssml`. Real SSML often
// carries attributes (xml:lang, version, xmlns) and is pasted with surrounding
// whitespace, so recognize the opening tag rather than a literal '<speak>' and
// ignore whitespace outside the document.
const SSML_DOCUMENT = /^<speak(?:\s[^>]*)?>([\s\S]*)<\/speak>$/

// Google caps input.ssml at 5,000 UTF-8 BYTES, not JavaScript characters. A
// CJK character is 3 bytes and an emoji 4, so char-counting chunks can be
// three times over the limit while looking fine in the editor.
const utf8Encoder = new TextEncoder()
const byteLength = (value) => utf8Encoder.encode(value).length

// An atom is a complete SSML entity or one Unicode code point (the `u` flag
// keeps surrogate pairs together), so a cut can never break either one.
const SSML_ATOM = /&(?:[a-zA-Z]+|#\d+|#x[\da-fA-F]+);|[\s\S]/gu

/**
 * Splits a text run that is itself larger than the byte budget. Cuts happen
 * only between atoms, preferring the last space so latin words stay whole.
 */
function splitTextByBytes(text, maxBytes) {
  const atoms = text.match(SSML_ATOM) ?? []
  const pieces = []
  let current = ''
  let bytes = 0

  for (const atom of atoms) {
    const size = byteLength(atom)
    if (current && bytes + size > maxBytes) {
      const lastSpace = /\s+\S*$/.exec(current)?.index ?? -1
      if (lastSpace > 0) {
        pieces.push(current.slice(0, lastSpace))
        current = current.slice(lastSpace)
        bytes = byteLength(current)
      } else {
        pieces.push(current)
        current = ''
        bytes = 0
      }
    }
    current += atom
    bytes += size
  }

  if (current) pieces.push(current)
  return pieces
}

/**
 * Builds the Google Cloud TTS `input` field. SSML must travel in `ssml` — as
 * written — or the API reads the tags out loud as plain text.
 */
export function synthesizeInput(text) {
  const source = String(text ?? '')
  return isSSMLText(source) ? { ssml: source.trim() } : { text: source }
}

export function isSSMLText(text) {
  return SSML_DOCUMENT.test(String(text ?? '').trim())
}

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
          // A clause with no internal separator still has to fit the limit.
          // Back up to the last space so a chunk never ends (or begins) in the
          // middle of a word; scripts without spaces and single tokens longer
          // than the limit keep the fixed-width cut, the only boundary there.
          let rest = clause
          while (rest.length > maxChars) {
            const window = rest.slice(0, maxChars)
            const lastSpace = /\s+\S*$/.exec(window)?.index ?? 0
            const cut =
              /\s/.test(rest[maxChars]) || lastSpace === 0
                ? maxChars
                : lastSpace
            const terminated = ensureTerminalPunctuation(
              rest.slice(0, cut).trim(),
            )
            if (terminated && terminated !== '.') output.push(terminated)
            rest = rest.slice(cut).trimStart()
          }
          current = rest
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
  // Split on newlines and on a terminal mark followed by whitespace. Do not
  // split on adjacent marks: `？？` / `!!` are emphatic punctuation, and a
  // bare mark chunk would be read aloud literally as "question mark". The
  // sentence segmenter handles CJK boundaries without a manual split.
  const linesAndCjkSentences = rawText
    .split(/\r?\n+|(?<=[。！？；!?])(?=\s)/)
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
  const maxRequestBytes = 5000
  const source = String(this).trim()
  const speakEndTag = '</speak>'
  const match = SSML_DOCUMENT.exec(source)
  // Guard against being called directly on non-SSML text.
  if (!match) return [source]

  // Keep the author's own opening tag (including any attributes) on every
  // chunk; replacing it with a bare '<speak>' would change the language and
  // namespace the SSML was written for. Both wrapper tags count toward the
  // 5,000-byte request budget, and attributes add bytes of their own.
  const speakStartTag = source.slice(0, source.indexOf('>') + 1)
  const maxContentBytes = Math.max(
    1,
    maxRequestBytes - byteLength(speakStartTag) - byteLength(speakEndTag),
  )
  const content = match[1]
  const chunks = []
  let currentChunk = ''
  let currentBytes = 0

  const pushChunk = () => {
    if (currentChunk) chunks.push(speakStartTag + currentChunk + speakEndTag)
    currentChunk = ''
    currentBytes = 0
  }

  const appendToken = (token) => {
    const size = byteLength(token)
    if (currentChunk && currentBytes + size > maxContentBytes) pushChunk()
    currentChunk += token
    currentBytes += size
  }

  const regex = /(<[^>]*>|[^<]+)/g
  let element

  while ((element = regex.exec(content)) !== null) {
    const token = element[0]

    // A single tag is indivisible. A text run longer than the remaining
    // budget (common with CJK prose) must be split at code-point boundaries.
    if (
      byteLength(token) > maxContentBytes - currentBytes &&
      token[0] !== '<'
    ) {
      for (const piece of splitTextByBytes(token, maxContentBytes)) {
        appendToken(piece)
      }
      continue
    }

    appendToken(token)
  }

  pushChunk()
  return chunks
}

String.prototype.isSSML = function () {
  return isSSMLText(this)
}
