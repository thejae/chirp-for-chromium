import winkNLP from 'wink-nlp'
import model from 'wink-eng-lite-web-model'

const nlp = winkNLP(model)
const CJK_REGEX = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/
const MAX_SENTENCE_CHARS = 120

/**
 * Normalizes decorative CJK brackets and quotation symbols (such as 『』, 「」,
 * 【】, 《》, ⟪⟫) into natural speech pauses so Google Cloud TTS Chirp3 / Journey
 * voices do not fail with sentence-tokenization errors.
 */
function normalizeTextForTts(input) {
  return input
    .replace(/[『「【〖〔《〈⟪［｛]+/g, ' ')
    .replace(/[』」】〗〕》〉⟫］｝]+(?=[^\s，。！？；：,.!?;:])/g, '，')
    .replace(/[』」】〗〕》〉⟫］｝]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Ensures a plain-text sentence ends with terminal punctuation so Google Cloud
 * TTS sentence validation never rejects unpunctuated headings or clauses.
 */
function ensureTerminalPunctuation(sentence) {
  const trimmed = sentence.trim().replace(/[，,；;：:、]+$/, '')
  if (!trimmed) return ''
  if (/[.!?。！？…]$/.test(trimmed)) return trimmed
  return CJK_REGEX.test(trimmed) ? `${trimmed}。` : `${trimmed}.`
}

/**
 * Splits a single overly long sentence into smaller clauses below
 * `MAX_SENTENCE_CHARS` so Google Cloud TTS never throws "sentences that are too long".
 */
function splitLongSentence(sentence) {
  const trimmed = normalizeTextForTts(sentence)
  if (!trimmed) return []
  if (trimmed.length <= MAX_SENTENCE_CHARS) {
    return [ensureTerminalPunctuation(trimmed)]
  }

  // Split by clause separators (commas, colons, enumeration commas, dashes)
  const clauses = trimmed.split(/(?<=[，,：:、—])\s*/)
  const results = []
  let current = ''

  for (const clause of clauses) {
    if (!clause) continue
    if ((current + clause).length <= MAX_SENTENCE_CHARS) {
      current += clause
    } else {
      if (current.trim()) results.push(ensureTerminalPunctuation(current))
      if (clause.length <= MAX_SENTENCE_CHARS) {
        current = clause
      } else {
        // Hard-split unpunctuated runs exceeding MAX_SENTENCE_CHARS
        for (let i = 0; i < clause.length; i += MAX_SENTENCE_CHARS) {
          const slice = clause.slice(i, i + MAX_SENTENCE_CHARS)
          if (slice.length === MAX_SENTENCE_CHARS) {
            results.push(ensureTerminalPunctuation(slice))
          } else {
            current = slice
          }
        }
      }
    }
  }

  if (current.trim()) {
    results.push(ensureTerminalPunctuation(current))
  }

  return results
}

String.prototype.chunk = function () {
  if (this.isSSML()) return this.chunkSSML()

  const rawText = String(this)
  // First split by newlines and CJK terminal punctuation so wink-nlp's
  // English-only model never merges CJK sentences or headings together.
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
