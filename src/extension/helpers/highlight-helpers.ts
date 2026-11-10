/**
 * In-page spoken sentence and word highlighter.
 *
 * Uses both Chromium's CSS Custom Highlight API (`CSS.highlights`) and a
 * non-intrusive `pointer-events: none` viewport overlay built from DOM
 * `Range.getClientRects()` so the active sentence and active word are always
 * clearly visible across any site theme or stacking context without mutating
 * webpage text nodes.
 */

export type CharEntry = {
  node: Text
  offset: number
  char: string
}

export type WordTiming = {
  word: string
  startIndex: number
  endIndex: number
  startRatio: number
  endRatio: number
}

const STYLE_ELEMENT_ID = 'chirp3-custom-highlight-styles'
const OVERLAY_CONTAINER_ID = 'chirp3-highlight-overlay'
const SENTENCE_HIGHLIGHT_NAME = 'chirp-sentence'
const WORD_HIGHLIGHT_NAME = 'chirp-word'

const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
])

let savedRange: Range | null = null
let charMap: CharEntry[] = []
let searchCursor = 0
let rafId: number | null = null
let userScrolled = false
let sessionActive = false
let isAudioLoading = false
let currentSentenceRange: Range | null = null
let currentWordRange: Range | null = null

function handleUserScroll() {
  userScrolled = true
  renderOverlayRects()
}

function handleViewportScrollOrResize() {
  renderOverlayRects()
}

function handleUserKeyScroll(event: KeyboardEvent) {
  if (SCROLL_KEYS.has(event.key)) {
    userScrolled = true
  }
}

function ensureHighlightStyles() {
  if (typeof document === 'undefined') return
  let style = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ELEMENT_ID
    ;(document.head || document.documentElement).appendChild(style)
  }
  style.textContent = `
    ::highlight(${SENTENCE_HIGHLIGHT_NAME}) {
      background-color: rgba(147, 197, 253, 0.38);
    }
    ::highlight(${WORD_HIGHLIGHT_NAME}) {
      background-color: rgba(250, 204, 21, 0.85);
      color: #000000;
    }

    @keyframes chirpPerimeterPulse {
      0% {
        outline-color: rgba(96, 165, 250, 0.35);
        box-shadow: 0 0 2px rgba(59, 130, 246, 0.2);
      }
      100% {
        outline-color: rgba(147, 197, 253, 0.95);
        box-shadow: 0 0 10px rgba(96, 165, 250, 0.55);
      }
    }

    .chirp-overlay-block {
      position: fixed;
      background-color: rgba(59, 130, 246, 0.16);
      border-radius: 3px;
      pointer-events: none;
      transition: outline 0.2s ease, box-shadow 0.2s ease;
    }

    .chirp-overlay-block-loading {
      outline: 1.5px solid rgba(96, 165, 250, 0.85);
      animation: chirpPerimeterPulse 1.4s infinite ease-in-out alternate;
    }

    @media (prefers-reduced-motion: reduce) {
      .chirp-overlay-block-loading {
        animation: none;
        outline: 1.5px solid rgba(96, 165, 250, 0.75);
        box-shadow: 0 0 4px rgba(59, 130, 246, 0.3);
      }
    }
  `
}

function getOrCreateOverlayContainer(): HTMLElement | null {
  if (typeof document === 'undefined' || !document.body) return null
  let container = document.getElementById(OVERLAY_CONTAINER_ID)
  if (!container) {
    container = document.createElement('div')
    container.id = OVERLAY_CONTAINER_ID
    container.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:2147483646;overflow:hidden;'
    document.body.appendChild(container)
  }
  return container
}

function clearOverlayContainer() {
  if (typeof document === 'undefined') return
  const container = document.getElementById(OVERLAY_CONTAINER_ID)
  if (container) {
    container.replaceChildren()
  }
}

function renderOverlayRects() {
  const container = getOrCreateOverlayContainer()
  if (!container) return
  container.replaceChildren()

  if (currentSentenceRange) {
    const rects = Array.from(currentSentenceRange.getClientRects())
    for (const rect of rects) {
      if (rect.width <= 0 || rect.height <= 0) continue
      const el = document.createElement('div')
      el.className = isAudioLoading
        ? 'chirp-overlay-block chirp-overlay-block-loading'
        : 'chirp-overlay-block'
      el.style.cssText = `
        position: fixed;
        left: ${rect.left - 1}px;
        top: ${rect.top - 1}px;
        width: ${rect.width + 2}px;
        height: ${rect.height + 2}px;
      `
      container.appendChild(el)
    }
  }

  if (currentWordRange) {
    const rects = Array.from(currentWordRange.getClientRects())
    for (const rect of rects) {
      if (rect.width <= 0 || rect.height <= 0) continue
      const el = document.createElement('div')
      el.style.cssText = `
        position: fixed;
        left: ${rect.left - 2}px;
        top: ${rect.top - 1}px;
        width: ${rect.width + 4}px;
        height: ${rect.height + 2}px;
        background-color: rgba(250, 204, 21, 0.42);
        border-bottom: 2px solid #d97706;
        border-radius: 3px;
        pointer-events: none;
      `
      container.appendChild(el)
    }
  }
}

function getCssHighlights(): any | null {
  if (typeof CSS !== 'undefined' && 'highlights' in CSS) {
    return (CSS as any).highlights
  }
  return null
}

function createCustomHighlight(range: Range): any | null {
  if (typeof (globalThis as any).Highlight === 'function') {
    return new (globalThis as any).Highlight(range)
  }
  return null
}

function cancelActiveAnimation() {
  if (rafId !== null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

/**
 * Extracts a flat character-by-character index map across all DOM `Text` nodes
 * intersecting the given `Range`.
 */
function buildCharMapFromRange(range: Range): CharEntry[] {
  const entries: CharEntry[] = []
  const root = range.commonAncestorContainer

  if (root.nodeType === Node.TEXT_NODE) {
    const textNode = root as Text
    const text = textNode.nodeValue || ''
    const start = range.startOffset
    const end = range.endOffset
    for (let i = start; i < end && i < text.length; i++) {
      entries.push({ node: textNode, offset: i, char: text[i] })
    }
    return entries
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let currentNode = walker.nextNode() as Text | null

  while (currentNode) {
    if (range.intersectsNode(currentNode)) {
      const text = currentNode.nodeValue || ''
      const start =
        currentNode === range.startContainer ? range.startOffset : 0
      const end =
        currentNode === range.endContainer ? range.endOffset : text.length

      for (let i = start; i < end && i < text.length; i++) {
        entries.push({ node: currentNode, offset: i, char: text[i] })
      }
    }
    currentNode = walker.nextNode() as Text | null
  }

  return entries
}

/**
 * Segments a synthesized sentence into word-like tokens using `Intl.Segmenter`
 * and matches each token sequentially against the flat `chars` string starting
 * at `startCursor`, returning word index spans and normalized timing ratios
 * `[startRatio, endRatio]` in `[0, 1]`.
 */
export function matchChunkWords(
  chunkText: string,
  fullDomString: string,
  startCursor: number,
): { timings: WordTiming[]; nextCursor: number } {
  const SegmenterCtor = (Intl as any).Segmenter
  const rawSegments: Array<{
    segment: string
    index: number
    isWordLike?: boolean
  }> =
    typeof SegmenterCtor === 'function'
      ? Array.from(
          new SegmenterCtor(undefined, { granularity: 'word' }).segment(
            chunkText,
          ),
        )
      : chunkText.split(/(\s+)/).map((segment, idx) => ({
          segment,
          index: idx,
          isWordLike: Boolean(segment.trim()),
        }))

  const matchedWords: Array<{
    word: string
    startIndex: number
    endIndex: number
    weight: number
  }> = []

  let cursor = startCursor

  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i]
    const word = seg.segment
    if (!word || (!seg.isWordLike && !/[\p{L}\p{N}]/u.test(word))) continue

    // Look ahead from cursor to find this word in fullDomString
    const foundAt = fullDomString.indexOf(word, cursor)
    if (foundAt === -1) continue

    const nextSeg = rawSegments[i + 1]?.segment || ''
    const hasPauseAfter = /[，,。！？；：.!?;:—]/.test(nextSeg)
    // Weight word duration by character length (minimum 1.5) plus clause pause
    const weight = Math.max(1.5, word.length) + (hasPauseAfter ? 2.5 : 0)

    matchedWords.push({
      word,
      startIndex: foundAt,
      endIndex: foundAt + word.length,
      weight,
    })

    cursor = foundAt + word.length
  }

  const totalWeight = matchedWords.reduce((sum, w) => sum + w.weight, 0) || 1
  let accumulated = 0

  const timings: WordTiming[] = matchedWords.map((w) => {
    const startRatio = accumulated / totalWeight
    accumulated += w.weight
    const endRatio = accumulated / totalWeight
    return {
      word: w.word,
      startIndex: w.startIndex,
      endIndex: w.endIndex,
      startRatio,
      endRatio,
    }
  })

  return { timings, nextCursor: cursor }
}

function createDomRangeFromCharSpan(
  entries: CharEntry[],
  startIndex: number,
  endIndex: number,
): Range | null {
  if (
    !entries.length ||
    startIndex < 0 ||
    endIndex <= startIndex ||
    endIndex > entries.length
  ) {
    return null
  }

  const first = entries[startIndex]
  const last = entries[endIndex - 1]
  if (!first?.node?.isConnected || !last?.node?.isConnected) return null

  const range = document.createRange()
  range.setStart(first.node, first.offset)
  range.setEnd(last.node, last.offset + 1)
  return range
}

function autoScrollToRangeIfNeeded(range: Range) {
  if (userScrolled || typeof window === 'undefined') return

  const rect = range.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return

  const margin = 90
  if (rect.top < margin || rect.bottom > window.innerHeight - margin) {
    const targetDelta = rect.top - window.innerHeight * 0.35
    window.scrollBy({ top: targetDelta, behavior: 'smooth' })
  }
}

/**
 * Captures the user's current DOM selection `Range`, prepares the character
 * map, attaches user-scroll disengagement listeners, and highlights the first
 * sentence immediately.
 */
export function startHighlightSession(payload?: {
  text?: string
  firstChunk?: string
}) {
  // Restore any previous saved selection before reading `window.getSelection()`
  endHighlightSession({ restoreSelection: true })

  if (typeof window === 'undefined') return

  const selection = window.getSelection()
  let candidateRange: Range | null = null
  let candidateMap: CharEntry[] = []

  if (selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed) {
    candidateRange = selection.getRangeAt(0).cloneRange()
    candidateMap = buildCharMapFromRange(candidateRange)
  }

  if (!candidateMap.length) return

  if (payload?.text) {
    const domStr = candidateMap.map((c) => c.char).join('')
    const { timings } = matchChunkWords(payload.text.slice(0, 120), domStr, 0)
    if (!timings.length) return
  }

  ensureHighlightStyles()
  savedRange = candidateRange
  charMap = candidateMap
  searchCursor = 0
  userScrolled = false
  sessionActive = true
  isAudioLoading = true

  window.addEventListener('wheel', handleUserScroll, { passive: true })
  window.addEventListener('touchmove', handleUserScroll, { passive: true })
  window.addEventListener('keydown', handleUserKeyScroll, { passive: true })
  window.addEventListener('scroll', handleViewportScrollOrResize, {
    passive: true,
    capture: true,
  })
  window.addEventListener('resize', handleViewportScrollOrResize, {
    passive: true,
  })

  // Hide the native browser blue selection so custom highlights are clearly visible
  if (selection && candidateRange) {
    selection.removeAllRanges()
  }

  // Highlight the entire block originally selected by the user for the whole session
  const fullBlockRange =
    savedRange || createDomRangeFromCharSpan(charMap, 0, charMap.length)
  if (fullBlockRange) {
    currentSentenceRange = fullBlockRange
    const highlights = getCssHighlights()
    const blockHighlight = createCustomHighlight(fullBlockRange)
    if (highlights && blockHighlight) {
      highlights.set(SENTENCE_HIGHLIGHT_NAME, blockHighlight)
    }
    renderOverlayRects()
  }
}

/**
 * Keeps the entire selected block highlighted and animates the active word
 * highlight across `duration` seconds using `requestAnimationFrame`.
 */
export function highlightChunk({
  text,
  duration,
}: {
  text: string
  duration: number
}) {
  cancelActiveAnimation()

  if (!sessionActive || !charMap.length || !text) return

  // Playback has begun: clear the loading perimeter animation
  isAudioLoading = false

  const highlights = getCssHighlights()
  const fullDomString = charMap.map((c) => c.char).join('')
  const { timings, nextCursor } = matchChunkWords(
    text,
    fullDomString,
    searchCursor,
  )

  if (!timings.length) return
  searchCursor = nextCursor

  const chunkStart = timings[0].startIndex
  const chunkEnd = timings[timings.length - 1].endIndex
  const chunkRange = createDomRangeFromCharSpan(charMap, chunkStart, chunkEnd)

  currentWordRange = null

  if (chunkRange) {
    autoScrollToRangeIfNeeded(chunkRange)
  }
  renderOverlayRects()

  const totalDurationMs =
    Number.isFinite(duration) && duration > 0
      ? duration * 1000
      : Math.max(800, text.length * 65)
  const startTime = performance.now()
  let lastWordIndex = -1

  function step(now: number) {
    if (!sessionActive) return

    const elapsed = now - startTime
    const ratio = Math.min(1, Math.max(0, elapsed / totalDurationMs))

    let activeIdx = timings.findIndex(
      (t) => ratio >= t.startRatio && ratio <= t.endRatio,
    )
    if (activeIdx === -1) {
      activeIdx = timings.length - 1
    }

    if (activeIdx !== lastWordIndex) {
      lastWordIndex = activeIdx
      const activeWord = timings[activeIdx]
      const wordRange = createDomRangeFromCharSpan(
        charMap,
        activeWord.startIndex,
        activeWord.endIndex,
      )
      currentWordRange = wordRange
      if (wordRange && highlights) {
        const wordHighlight = createCustomHighlight(wordRange)
        if (wordHighlight) {
          highlights.set(WORD_HIGHLIGHT_NAME, wordHighlight)
        }
      }
      renderOverlayRects()
    }

    if (ratio < 1) {
      rafId = requestAnimationFrame(step)
    } else {
      rafId = null
    }
  }

  rafId = requestAnimationFrame(step)
}

/**
 * Stops any active word highlight animation, removes `CSS.highlights` and
 * overlay entries, detaches scroll listeners, and restores the user's original
 * DOM selection.
 */
export function endHighlightSession(
  options: { restoreSelection?: boolean } = { restoreSelection: true },
) {
  cancelActiveAnimation()

  if (typeof window !== 'undefined') {
    window.removeEventListener('wheel', handleUserScroll)
    window.removeEventListener('touchmove', handleUserScroll)
    window.removeEventListener('keydown', handleUserKeyScroll)
    window.removeEventListener('scroll', handleViewportScrollOrResize, true)
    window.removeEventListener('resize', handleViewportScrollOrResize)
  }

  currentSentenceRange = null
  currentWordRange = null
  clearOverlayContainer()

  const highlights = getCssHighlights()
  if (highlights) {
    highlights.delete(SENTENCE_HIGHLIGHT_NAME)
    highlights.delete(WORD_HIGHLIGHT_NAME)
  }

  if (
    options.restoreSelection !== false &&
    savedRange &&
    typeof window !== 'undefined'
  ) {
    try {
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
        selection.addRange(savedRange)
      }
    } catch {
      // Ignore if DOM nodes from original selection were removed by page scripts
    }
  }

  savedRange = null
  charMap = []
  searchCursor = 0
  sessionActive = false
  isAudioLoading = false
}
