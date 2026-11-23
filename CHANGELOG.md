# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [13.15.5] - 2026-11-23

### Fixed
- **A Failed Audio Chunk No Longer Freezes Reading**: when the offscreen player rejected playback (blocked autoplay, unreadable audio), the message listener never sent a response, so the service worker waited forever and the docked player stayed on "Reading" with the page highlight stuck. Rejected handlers now reply with an error, and the reader tears down and surfaces the failure instead of hanging.

## [13.15.4] - 2026-11-23

### Fixed
- **Selection Toolbar Now Stands Out on Dark Pages**: the floating pill's dark style used a near-black `#171717` surface with a low-opacity grey border, so it all but vanished against the near-black article pages where it appears most. It now uses the smoked-glass treatment from the mockups: a translucent dark slate surface (`rgba(28, 34, 48, 0.6)`), a 2px white hairline border, `blur(5px)` with `saturate(450%)` so colours from the page diffuse through it, and the same 2px gradient reading-progress bar at the bottom as before. Light pages keep their existing frosted white pill.

## [13.15.3] - 2026-11-23

### Fixed
- **SSML Typed Into the Sandbox Now Reaches Google as SSML**: pasted `<speak>` markup with a leading newline was chopped into malformed markup (`<speak>ak>…`), and SSML with a normal attribute such as `xml:lang="en-US"` was treated as plain text, with the tags read out loud. Both cases are now recognized as SSML and sent verbatim in the API's `ssml` field instead of `text`. Long SSML is still split at tag boundaries, but every piece keeps the original `<speak>` tag and stays within the API's 5,000-character limit. The Sandbox footer shows **SSML** when your input was recognized.

## [13.15.2] - 2026-11-22

### Fixed
- **Repeated Marks Are No Longer Spoken Out Loud**: emphatic punctuation like `？？`, `！！！`, `?!` used to be split into a normal sentence plus a bare mark chunk, and Google Cloud TTS read that bare `？` / `!` literally as "question mark" / "exclamation mark". A run of marks now stays with the sentence it ends, so `真的吗？？` and `What??` are each spoken as one sentence with the intended emphasis. The fix also holds when the run sits before a closing bracket (`「真的吗？？」`) or mixes with ellipses (`Done...!!`).

## [13.15.1] - 2026-11-22

### Fixed
- **Chinese (and Other Native Scripts) Keep Their Question Marks, Exclamations and Commas**: the chunker used to rewrite `？` and `！` into plain full stops and every `，` / `、` into a spaced ASCII comma, so Chinese read aloud came out flat — questions and exclamations lost their rising/falling tone and each comma added a fake word break. Native terminal marks and clause commas now reach the TTS engine exactly as written, for every script with its own punctuation (Arabic `،` / `؟`, Devanagari `।`, Ethiopic `።`, and CJK marks included). Only a sentence the author left unterminated gets a synthesized full stop, and a trailing comma is dropped instead of being followed by one. Decorative CJK brackets (`「」`, `『』`, `《》`) still normalize to a native period so Chirp3's sentence-length check stays happy; commas stay tight so numbers like `1,000` are spoken as one number.

## [13.15.0] - 2026-11-15

### Added
- **Exported Logs Name Their Environment**: a downloaded log now opens with the extension build, the browser build and the operating system it was captured on, followed by the raw browser string. A bug report can be read on its own, without a follow-up question about which Chrome or Edge build it happened on. Anything a browser declines to reveal comes through as `unknown` rather than a blank line, so the header is never missing and never guesses.

## [13.14.0] - 2026-11-15

### Added
- **Repeated Reads Cost Nothing**: reading the exact same text again in the same browsing session replays the audio that was already synthesized for it instead of asking Google a second time, so re-listening costs zero characters. Only an identical request counts as identical, so changing the voice, language, encoding, speed, pitch, gain or effects profile is billed again — the audio really is different. A session keeps at most 6 MB of audio and forgets what you listened to least recently once it is full, and it empties when you close the browser or the extension reloads. Worth knowing: when a long sentence falls back from Chirp3 to a WaveNet voice, that fallback take is what a repeat plays back, and clearing the cache starts you over.
- **Clear Cached Audio In Settings**: a new **Clear** button in the settings card drops everything the session has synthesized so far. It releases the memory straight away, the next read of the same text pays the API again, and it is the quickest way to hear a fresh take after changing voice or speed. The **Logs** view records how many clips were dropped.

### Changed
- **Opening The Popup No Longer Speaks By Itself**: auto-read is now opt-in. Highlighting text and opening the popup leaves the page silent until you turn the **Auto-read aloud** toggle on; that toggle used to default to on, so anyone who never touched it now starts reading on demand through the right-click menu, the selection toolbar or the keyboard shortcut.

## [13.13.2] - 2026-11-15

### Fixed
- **Long Downloads No Longer Come Back Empty**: a 20,000-character paste used to fire ~250 synthesis requests at once, Google rejected much of that burst with `429`, and the download produced no file at all while still billing every call. Chunks are now synthesized a few at a time and stitched together in order.
- **A Failed Chunk Ends Reading Instead of Freezing It**: any request failure left the popup stuck on "Reading" with the page highlight never cleared. Sessions now tear down on the first failure and tell you it failed.
- **Your Selection Is No Longer Spoken Twice**: opening the popup (auto-read) and right-clicking "Read aloud" within a second of each used to play the same text twice. A read-aloud session is now claimed before anything else can start.
- **No Repeated Words on Long Sentences**: a clause that hit the API's sentence limit exactly was synthesized and spoken twice.
- **Docked Player Shows the Voice You Actually Chose**: the player badge always read "Default" regardless of the voice picked in **Voice & speech**.
- **Voice & speech Survives Obscure Languages**: languages the browser doesn't recognise (`zh-YUE`, `haw-US-HAW`) replaced the voice list with a generic "Something went wrong" screen. They now fall back to their raw language code.
- **Right-Click Menu Tracks Reading State**: the Read / Stop / Download menu items used to describe a session that had already finished, because the menu refresh raced the player state.
- **Opening a Dialog No Longer Clears Your Highlight**: opening the onboarding or keyboard-shortcut dialog discarded whatever text you had selected on the page.
- **Release Archives Load Again**: uploaded zips buried `manifest.json` inside a `dist/` folder, so the Chrome Web Store and Edge Addons rejected every upload. `manifest.json` is now at the archive root.

### Changed
- **One Voice Resolution per Session**: the voice used to be re-resolved for every sentence, which made a 40-sentence page re-index several hundred voices 40 times before the first byte of audio played. It is now resolved once per session, so changing the voice while audio is playing keeps that session on one voice.
- **Sentences Are Split by the Browser**: sentence detection no longer depends on `wink-nlp`; the platform's own language rules are used instead, and `chunk()` was verified to produce identical output on abbreviation-heavy ("Dr.", "U.S.", "3.14 p.m."), CJK, SSML and run-on samples.
- **Highlighting Work Cut Down**: the read-aloud page highlight no longer rebuilds the selection text per chunk or a fresh set of overlay elements on every scroll and resize, which used to make long pages stutter while reading.
- **Website and In-App Links Point at This Fork**: the install buttons and sidebar no longer send you to the upstream paid Chrome Web Store listing, and the site's name, copy and privacy contact speak for Chirp3 for Chromium.
- **Smaller, Faster Extension**: built code ships minified, which took the download from 6.9 MB to 1.2 MB per browser build (the archives went from 1.5 MB to 375 KB). Nothing you can see in the interface changes.

### Removed
- **Sentry Error Reporting**: the extension no longer uploads errors to a third-party account (the compiled-in reporting address belonged to the upstream author's project, which this fork cannot see, redact, or delete). Failures are still logged inside the extension's **Logs** view, which keeps the details on your machine. The privacy policy no longer lists Sentry as a recipient.
- **Dead Weight and Dead Code**: unused dependencies (`dotenv`, `esbuild`, `process`, `wink-nlp`, `wink-eng-lite-web-model`), leftovers from the paid account mode removed in v13.13.0, the sidebar's upstream store link, and 13.9 MB of upstream release archives that had been committed by mistake.

### Added
- **Tests for the Risky Paths**: `bun test` now covers sentence chunking, audio-file merging and word timing — the places a bad result used to show up only as a user complaint (14 tests, 58 assertions).

## [13.13.1] - 2026-11-15

### Fixed
- Restored the missing `React` import in `src/extension/components/views/Credentials.tsx` and `src/extension/components/dialogs/OnboardingDialog.tsx`, so the open-source Credentials tab and API-key onboarding dialog render instead of throwing `"React is not defined"`.

## [13.13.0] - 2026-11-15

### Removed
- **Paid mode, credits, invoices, account sign-in, OAuth, and proprietary backend dependencies**: The extension no longer has Billing/Usage screens, payment sessions, credit balance flows, Google OAuth authentication, or backend API calls.
- Deleted paid UI/helpers and stale docs copy: `Billing.tsx`, `Usage.tsx`, `PricingTable.jsx`, paid `Notice` copy, credit/date formatting helper, website paid changelog entry, paid-version asset, Stripe/payment privacy references, and README/backend setup instructions.

### Changed
- **API-key-only operation**: The extension now uses only the user's Google Cloud Text-to-Speech API key for voice discovery and synthesis via direct `TTS_API_URL` endpoints.
- Replaced the Billing route with a Credentials view, updated navigation/onboarding to focus on API-key verification, removed paid-mode storage handling, and configured the Chrome/Edge builds without `BACKEND_URL` or OAuth client env vars.

## [13.12.1] - 2026-11-15

### Changed
- **Keeps Your Own Page Highlights**: `src/extension/helpers/highlight-helpers.ts` now checks whether any other lines are highlighted on the page when a Read Aloud session finishes. If they are, the sentences that were just read are no longer re-highlighted, so your own selections are left untouched.
- **Multi-Range Selections Restored Fully**: When nothing else is highlighted, reading now restores every line you originally selected (Ctrl/Cmd-click multi-selections) instead of only the first range.

## [13.12.0] - 2026-11-13

### Added
- **Light & Dark Theme with System Auto-Detection**: Added `src/hooks/useTheme.ts` and enabled Tailwind `darkMode: 'class'` in `tailwind.config.cjs`. By default (`theme: 'system'`), the extension auto-detects the browser/OS color scheme via `prefers-color-scheme: dark` and updates live when the system theme changes.
- **Appearance Theme Selector**: Added a **System / Light / Dark** segmented control in `src/extension/components/views/Settings.tsx` persisted via `chrome.storage.sync`.
- **Themed Floating Pop-up Player & Dialogs**: Applied the active light/dark theme to `src/extension/components/player/SelectionToolbar.tsx` and Shadow DOM dialogs in `src/extension/content-script.tsx`, as well as all popup views, sidebar, `MiniPlayer`, and shared input/dialog components.

## [13.11.0] - 2026-11-13

### Added
- **Floating Selection Toolbar (`SelectionToolbar`)**: Added `src/extension/components/player/SelectionToolbar.tsx` mounted in `src/extension/content-script.tsx`. Selecting text on any webpage displays a slim `rounded-3xl` floating pill with **Read** and **Download** actions; during playback, it collapses into icon-only **Pause / Resume**, **Stop**, and **Download** controls.
- **Full-Selection Reading Progress Bar**: Updated `src/extension/service-worker.ts` (`totalChars`, `completedChars`, and intra-chunk timing) so the 2px gradient progress bar tracks progress across the entirety of the selected text rather than resetting per audio chunk.
- **Show Floating Selection Toolbar Setting**: Added `showSelectionToolbar` toggle in `src/extension/components/views/Settings.tsx` (default enabled) so users can disable the in-page selection toolbar if preferred.

## [13.10.0] - 2026-11-10

### Added
- **Persistent MiniPlayer Audio Bar**: Docked audio controller (`src/extension/components/player/MiniPlayer.tsx`) displayed across popup views with non-destructive Play / Pause / Resume controls preserving the user's sentence position, real-time sentence progress (`Sentence X of Y`), elapsed indicator, active text snippet preview, and active voice details pill with direct navigation to Preferences.
- **Audio Pause & Resume Engine**: Implemented non-destructive audio pausing and resumption across `src/extension/offscreen.ts`, `src/extension/service-worker.ts`, and in-page highlighting in `src/extension/helpers/highlight-helpers.ts` (`highlightPause`, `highlightResume`).
- **Show Persistent Audio Player Toggle**: Added user setting in `src/extension/components/views/Settings.tsx` (`showMiniPlayer`, default enabled) allowing users to turn off the bottom audio player bar whenever desired.
- **React ErrorBoundary**: Added top-level error boundary (`src/components/ErrorBoundary.tsx` and `src/extension/popup.tsx`) preventing white-screen crashes on unhandled render errors with a friendly reload action.
- **Accessible Dialog Focus Trap**: Added keyboard Tab focus trapping and previous focus restoration on dismissal in `src/components/Dialog.tsx`.

### Changed
- **WCAG Non-Text Contrast Compliance**: Increased inactive settings switch track contrast in `src/extension/components/views/Settings.tsx` to ≥ 3:1 (`border-neutral-400` on `bg-neutral-200`) meeting WCAG 1.4.11.
- **Semantic External Links**: Rendered external navigation links (Changelog, Contribute, Review) in `src/extension/components/Sidebar.jsx` as semantic `<a href="..." target="_blank" rel="noopener noreferrer">` tags.
- **Reduced Motion Support**: Updated programmatic window scrolling in `src/extension/helpers/highlight-helpers.ts` to respect `prefers-reduced-motion: reduce`.

## [13.9.0] - 2026-11-10

### Added
- Added visual loading feedback state to in-page text highlighting: when Read Aloud starts and audio is requested from Google Cloud TTS, the selected block displays an animated glowing perimeter pulse (`1.5px` azure outline with soft pulsing shadow aura) in `src/extension/helpers/highlight-helpers.ts`, providing immediate visual confirmation of synthesis in flight before smoothly transitioning into active word-tracking playback. Includes `prefers-reduced-motion` support.

## [13.8.1] - 2026-11-10

### Fixed
- Prevented **Preview voice** (`src/extension/components/views/Preferences.tsx`) and **Sandbox** (`src/extension/components/views/Sandbox.tsx`) playback from triggering in-page webpage highlights (`highlight: false` in `readAloud` and removed fallback `document.body` scanning in `src/extension/helpers/highlight-helpers.ts`).

## [13.8.0] - 2026-11-10

### Changed
- Updated `npm run build:extension` (`build.js` and `src/extension/manifest.ts`) to build both **Chrome** (`chirp3-for-chrome-<version>.zip`) and **Microsoft Edge** (`chirp3-for-edge-<version>.zip`) simultaneously when `--browser` is not explicitly specified, and added `npm run build:extension:chrome` alongside `npm run build:extension:edge` for single-target builds.

## [13.7.2] - 2026-11-10

### Changed
- Updated in-page highlighting in `src/extension/helpers/highlight-helpers.ts` to keep the **entire originally selected block** highlighted throughout the Read Aloud session while the active word highlight progresses word-by-word inside it.

### Fixed
- Fixed Chinese text synthesis failing with `Sentence starting with: "⟪群策群力" is too long` by converting fullwidth CJK punctuation/brackets to ASCII periods/commas in `src/extension/helpers/text-helpers.js`, automatically switching to a `cmn-CN` voice when CJK ideographs are synthesized under a non-CJK voice in `src/extension/service-worker.ts`, and adding an automatic WaveNet fallback retry if a Chirp3 voice hits a token-length error.

## [13.7.1] - 2026-11-10

### Changed
- Updated Changelog link in `src/extension/components/Sidebar.jsx` and `src/extension/service-worker.ts` to point to `https://github.com/thejae/chirp-for-chromium/blob/master/CHANGELOG.md`.

### Fixed
- Fixed in-page sentence and word highlighting not appearing on tabs where `window.onload` had already fired before `document_idle` (or on tabs opened prior to extension reload) by registering `chrome.runtime.onMessage` immediately at module load in `src/extension/content-script.tsx`, auto-injecting `content-script.js` on demand in `sendMessageToCurrentTab`, decoding streaming `OGG_OPUS` durations via `AudioContext.decodeAudioData` in `src/extension/offscreen.ts`, and rendering a viewport `DOMRect` highlight overlay alongside `CSS.highlights` in `src/extension/helpers/highlight-helpers.ts`.

## [13.7.0] - 2026-11-10

### Added
- In-page spoken sentence (`::highlight(chirp-sentence)`) and word (`::highlight(chirp-word)`) highlighting during Read Aloud using the Chromium CSS Custom Highlight API (`src/extension/helpers/highlight-helpers.ts`, `src/extension/content-script.tsx`, `src/extension/offscreen.ts`, `src/extension/service-worker.ts`).
- Smart auto-scrolling when the active sentence exits the viewport, automatically disengaging if the user scrolls manually until the next Read Aloud session.
- **Highlight spoken words on page** toggle in `src/extension/components/views/Settings.tsx` (enabled by default), with automatic restoration of the user's original DOM selection when reading finishes or stops.

## [13.6.3] - 2026-11-10

### Fixed
- Fixed Microsoft Edge installing a duplicate copy of the unpacked extension and resetting saved preferences on reload by always preserving the deterministic manifest `key` in `src/extension/manifest.ts` across both development and production Edge builds.

## [13.6.2] - 2026-11-10

### Fixed
- Fixed Google Cloud TTS Chirp3 synthesis failing on Chinese brackets/symbols (e.g. `『群策群力』关于论坛邀请机制改进` throwing `Sentence starting with: "「⟪群策群" is too long`) by normalizing CJK corner/lenticular brackets into speech pauses, splitting on CJK sentence/clause punctuation (`。！？；`), and ensuring terminal punctuation on each chunk in `src/extension/helpers/text-helpers.js`.

## [13.6.1] - 2026-11-10

### Changed
- Changed **Auto-read highlighted text** (`autoReadAloud`) to trigger only when the extension icon is clicked and the popup opens (`autoReadOnPopupOpen` in `src/extension/service-worker.ts` and `src/extension/extension.tsx`) instead of on every webpage mouse selection.

## [13.6.0] - 2026-11-10

### Added
- Dedicated **Settings** tab (`src/extension/components/views/Settings.tsx`) with an **Auto-read highlighted text** toggle (`autoReadAloud` in `chrome.storage.sync`).
- Automatic webpage selection listener (`mouseup` / `Shift` `keyup` with 300ms debounce) in `src/extension/content-script.tsx` that automatically reads newly highlighted text aloud when `autoReadAloud` is enabled.

## [13.5.0] - 2026-11-09

### Changed
- Renamed extension from **Wavenet for Chrome** to **Chirp3 for Chromium** across `manifest.ts`, `popup.html`, `Sidebar.jsx`, `Notice.jsx`, `OnboardingDialog.tsx`, `Logs.tsx`, `error-helpers.ts`, `build.js`, `package.json`, and `README.md`.

## [13.4.1] - 2026-11-09

### Changed
- Made request/response bodies and details in the **Log** view (`src/extension/components/views/Logs.tsx`) collapsible via native `<details>` disclosures (collapsed by default) and moved **Export log** and **Clear** buttons to the bottom right.

### Fixed
- Fixed audio download failing on Chirp/Journey/Studio voices with `"This voice currently only supports the following audio encodings: LINEAR16, MP3, OGG_OPUS, MULAW, ALAW"` by normalizing legacy `MP3_64_KBPS` to standard `MP3` in `src/extension/service-worker.ts` and `src/extension/components/views/Preferences.tsx`.

## [13.4.0] - 2026-11-09

### Added
- Added **Opus (OGG)** (`OGG_OPUS`), **Uncompressed PCM (WAV)** (`PCM`), and **WAV (Linear 16-bit)** (`LINEAR16`) options to the **Download format** dropdown (`src/extension/components/views/Preferences.tsx`) with dynamic button labels (`Download MP3`, `Download OGG`, `Download WAV`).
- Added lossless multi-chunk RIFF/WAVE header stitching (`mergeAudioChunks` in `src/extension/helpers/file-helpers.ts`) so long multi-sentence `PCM` / `LINEAR16` downloads play continuously from start to finish.

### Fixed
- Fixed `npm run start:extension:edge` (and `npm run start:extension`) appearing stuck at `Built css` by invoking the Tailwind CLI directly via `process.execPath` instead of `npx`, correcting the `console.time` / `console.timeEnd` label mismatch in `build.js`, and printing explicit watch-mode status messages (`✅ Extension ready in ./dist` and `👀 Watching src/ for changes...`).

## [13.3.0] - 2026-11-09

### Added
- Dedicated **Log** tab (`src/extension/components/views/Logs.tsx` and `src/extension/helpers/log-helpers.ts`) displaying verbose extension runtime events and redacted API request/response diagnostics (`loggedFetch`), with **Export log** (`.txt`) and **Clear** buttons.
- Clickable **Read aloud** (toggles to **Stop reading** while audio is playing) and **Download MP3** buttons in `Preferences.tsx` to synthesize highlighted text on the active webpage without needing keyboard shortcuts.

### Changed
- Set the extension popup (`src/extension/extension.tsx`) to always open the **Voice & speech** (`/preferences`) tab by default.
- Moved the **Speaking speed** preset buttons (`0.75×`, `1×`, `1.25×`, `1.5×`, `2×`) onto their own row below the slider in `src/components/inputs/Range.jsx`.

## [13.2.0] - 2026-11-09

### Added
- Inline **Preview voice** button in `Preferences.tsx` to audition the selected language, voice, speed, and pitch without leaving the settings screen.
- Active voice & speed context badge in `Sandbox.tsx` (`en-US · Wavenet D · 1×`) with quick navigation to `Voice & speech`, plus live character count.
- Speed preset chips (`0.75×`, `1×`, `1.25×`, `1.5×`, `2×`) and one-click reset-to-default on `Range.jsx` sliders.
- Show/hide password toggle on `Text.jsx` for Google Cloud API key entry in `ApiKey.tsx`.
- Keyboard-dismissible (`Escape`) `Dialog.tsx` with ARIA dialog semantics, plus combobox/listbox ARIA roles and `useId()` label bindings across `Dropdown.jsx`, `Range.jsx`, `Text.jsx`, and `Textarea.jsx`.
- Inline `HowToUseTip` and keyboard shortcut reference in `Preferences.tsx`, `Credentials.tsx`, and `OnboardingDialog.tsx`.

### Changed
- Renamed the mislabeled `"Credentials"` section header in `Preferences.tsx` to `"Voice & speech"`, reordered `Sidebar.jsx` around audio workflows first, and compacted the sidebar width (`w-44`) to give the main view more space.
- Placed advanced DSP and codec settings (`Device EQ profile`, `Voice pitch`, `Volume gain`, `Download/Streaming format`) inside a progressive-disclosure panel in `Preferences.tsx`.
- Raised `text-xxs` from `10px` to `11px` (`0.6875rem`), refined section heading hierarchy, added `prefers-reduced-motion` support, and replaced overshoot bounce/timer animations with smooth exponential easing.
### Fixed
- Fixed `Dropdown.jsx` firing `onChange` on raw search keystrokes and replaced `document.querySelector` with a container-scoped ref.
- Fixed invalid API key validation message in `Sandbox.tsx` to reference `Credentials` instead of `preferences`.

## [13.1.0] - 2026-11-09

### Added
- Microsoft Edge compatibility for both unpacked development loading (`npm run start:extension:edge`) and Microsoft Edge Add-ons store packaging (`npm run build:extension:edge`).
- Offscreen document detection via `chrome.runtime.getContexts` before falling back to `clients.matchAll()`.
- Browser-aware shortcut settings navigation (`edge://extensions/shortcuts` on Edge, `chrome://extensions/shortcuts` on Chrome).

### Changed
- Adopted standard 3-part SemVer version (`13.1.0`) required by Microsoft Edge Add-ons Partner Center.
- Standardized Manifest V3 icon definitions (`16`, `19`, `38`, `48`, `128`) and omitted store-rejected `key` fields on Edge builds.
