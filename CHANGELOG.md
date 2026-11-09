# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
