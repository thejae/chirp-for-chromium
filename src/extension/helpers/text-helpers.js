import winkNLP from 'wink-nlp'
import model from 'wink-eng-lite-web-model'

const nlp = winkNLP(model)
const CJK_REGEX = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/
const MAX_SENTENCE_CHARS = 80
const MAX_CJK_SENTENCE_CHARS = 35

/**
 * Normalizes decorative CJK brackets and quotation symbols (such as 『』, 「」,
 * 【】, 《》, ⟪⟫) into ASCII period sentence breaks so Google Cloud TTS Chirp3
 * voices never fail with `Sentence starting with: "⟪..." is too long`.
 */
function normalizeTextForTts(input) {
  return input
    .replace(/[『「【〖〔《〈⟪［｛“‘「]+/g, ' ')
    .replace(/[』」】〗〕》〉⟫］｝”’」]+/g, '. ')
    .replace(/[。！？；]+/g, '. ')
    .replace(/[，、：]+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Ensures a plain-text sentence ends with an ASCII terminal punctuation mark
 * (`.`, `!`, or `?`) because Google Cloud TTS Chirp3's sentence-length
 * validator specifically checks for ASCII periods.
 */
function ensureTerminalPunctuation(sentence) {
  const trimmed = sentence
    .trim()
    .replace(/[，,；;：:、。]+$/g, '')
    .trim()
  if (!trimmed) return ''
  if (/[.!?]$/.test(trimmed)) return trimmed
  return `${trimmed}.`
}

/**
 * Splits a single sentence into smaller clauses below `maxChars` so Google
 * Cloud TTS Chirp3 never throws "sentences that are too long".
 */
function splitLongSentence(sentence) {
  const normalized = normalizeTextForTts(sentence)
  if (!normalized) return []

  // First split on any periodbreaks introduced by bracket/CJK normalization
  const subSentences = normalized
    .split(/(?<=[.!?])\s+/)
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
    const clauses = sub.split(/(?<=[，,：:、—])\s*/)
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
    const winkSentences = nlp.readDoc(segment).sentences().out('array')
    return winkSentences.length ? winkSentences : [segment]
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
