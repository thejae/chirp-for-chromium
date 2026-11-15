export function getVoiceOptions(session, language) {
  if (!session?.voices) return []

  const voicesInLanguage = session.voices.filter((voice) =>
    voice.languageCodes.includes(language),
  )

  const uniqueVoiceNames = new Set()

  const voiceNames = voicesInLanguage
    .map(({ name: value, ssmlGender }) => {
      const title = value.split('-').slice(2).join(' ')
      const description =
        ssmlGender.charAt(0).toUpperCase() + ssmlGender.toLowerCase().slice(1)
      return { value, title, description }
    })
    .filter(({ value }) => {
      if (uniqueVoiceNames.has(value)) {
        return false
      }

      uniqueVoiceNames.add(value)
      return true
    })
    .sort((a, b) => a.title.localeCompare(b.title))

  return voiceNames
}

export function getLanguageOptions(session) {
  if (!session?.languages) return []
  const displayNames = new Intl.DisplayNames(['en-US'], {
    type: 'language',
    languageDisplay: 'standard',
  })

  const languageNames = session.languages.map((value) => {
    // Intl.DisplayNames.of throws a RangeError for codes the browser's ICU
    // data does not know (for example `zh-YUE`), which used to crash the
    // whole settings view, so fall back to showing the raw code.
    let displayName: string
    try {
      displayName = displayNames.of(value)
    } catch {
      displayName = value
    }

    let [title, ...tail] = displayName.split(' ')
    title += ` (${value.split('-')[1]})`
    let description = tail.join(' ')
    if (description.startsWith('(')) description = description.slice(1, -1)
    if (description.endsWith(')')) description = description.slice(0, -1)

    return { value, title, description }
  })

  const sortedLanguages = Array.from(languageNames).sort((a: any, b: any) => {
    if (a.title < b.title) return -1
    if (a.title > b.title) return 1
    return 0
  })

  return sortedLanguages
}

export function getCurrentVoice(session, sync) {
  const languageOptions = getLanguageOptions(session)
  const voiceOptions = getVoiceOptions(session, sync.language)

  return sync.voices[sync.language] || voiceOptions[0]?.value
}

/**
 * Resolves the voice pair a chunk loop needs once instead of once per chunk:
 * the configured voice, plus the Mandarin voice to use for chunks that carry
 * Chinese ideographs (Chirp3/Journey voices reject those outright). Building
 * the voice options and the availability index costs hundreds of comparisons,
 * so Read Aloud pays this cost once per session and hands the pair to every
 * chunk.
 */
export function resolveVoices(session, sync) {
  const languageCode = sync.language || 'en-US'
  const voiceName = getCurrentVoice(session, sync)

  const isCjkLanguage = /^(cmn|zh|yue|ja|ko)-/i.test(languageCode)
  let cjkVoiceName: string | null = null
  if (!isCjkLanguage) {
    const availableNames = new Set(
      (session.voices || []).map((voice: any) => voice.name),
    )
    const persona = voiceName?.includes('-Chirp3-HD-')
      ? voiceName.split('-Chirp3-HD-')[1]
      : null
    const candidateChirp = persona ? `cmn-CN-Chirp3-HD-${persona}` : null

    cjkVoiceName =
      candidateChirp && availableNames.has(candidateChirp)
        ? candidateChirp
        : sync.voices?.['cmn-CN'] ||
          (availableNames.has('cmn-CN-Wavenet-A')
            ? 'cmn-CN-Wavenet-A'
            : candidateChirp || 'cmn-CN-Wavenet-A')
  }

  return {
    languageCode,
    voiceName,
    cjkLanguageCode: isCjkLanguage ? languageCode : 'cmn-CN',
    cjkVoiceName,
  }
}
