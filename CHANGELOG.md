# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Inline `HowToUseTip` and keyboard shortcut reference in `Preferences.tsx`, `Billing.tsx`, and `OnboardingDialog.tsx`.

### Changed
- Renamed the mislabeled `"Credentials"` section header in `Preferences.tsx` to `"Voice & speech"`, reordered `Sidebar.jsx` around audio workflows first, and compacted the sidebar width (`w-44`) to give the main view more space.
- Placed advanced DSP and codec settings (`Device EQ profile`, `Voice pitch`, `Volume gain`, `Download/Streaming format`) inside a progressive-disclosure panel in `Preferences.tsx`.
- Raised `text-xxs` from `10px` to `11px` (`0.6875rem`), refined section heading hierarchy, added `prefers-reduced-motion` support, and replaced overshoot bounce/timer animations with smooth exponential easing.
- Simplified `PricingTable.jsx` around human-readable capacity for the `$9.75` credit pack with `tabular-nums`.

### Fixed
- Imported missing `isError` helper in `OnboardingDialog.tsx` to prevent a `ReferenceError` when payment session creation fails.
- Wired `loadingUser` and `loadingUsage` loading states and list `key` props in `Usage.tsx` to prevent flashing `$0.00` credits and `"No usage yet"`.
- Fixed `Dropdown.jsx` firing `onChange` on raw search keystrokes and replaced `document.querySelector` with a container-scoped ref.
- Fixed invalid API key validation message in `Sandbox.tsx` to reference `Credentials` instead of `preferences`.

## [13.1.0] - 2026-11-09

### Added
- Microsoft Edge compatibility for both unpacked development loading (`npm run start:extension:edge`) and Microsoft Edge Add-ons store packaging (`npm run build:extension:edge`).
- Google OAuth2 authentication fallback via `chrome.identity.launchWebAuthFlow` in `src/extension/service-worker.ts` for browsers where `chrome.identity.getAuthToken` is unsupported (such as Microsoft Edge).
- Offscreen document detection via `chrome.runtime.getContexts` before falling back to `clients.matchAll()`.
- Browser-aware shortcut settings navigation (`edge://extensions/shortcuts` on Edge, `chrome://extensions/shortcuts` on Chrome).

### Changed
- Adopted standard 3-part SemVer version (`13.1.0`) required by Microsoft Edge Add-ons Partner Center.
- Standardized Manifest V3 icon definitions (`16`, `19`, `38`, `48`, `128`) and conditionally omitted Chrome-specific `oauth2` and store-rejected `key` fields on Edge builds.
