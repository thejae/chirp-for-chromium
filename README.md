<div align="center">

# Chirp3 for Chromium

**Turn any highlighted webpage text into natural Google Cloud Chirp3 & WaveNet speech — with live in-page tracking, pause/resume, and MP3/OGG/PCM export.**

![Version](https://img.shields.io/badge/version-13.11.0-2563eb?style=flat-square)
![Browsers](https://img.shields.io/badge/browsers-Chrome%20%26%20Edge%20(MV3)-10b981?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-neutral?style=flat-square)

</div>

---

## What's New Since Forking

| | |
| :--- | :--- |
| **🎯 Floating Selection Toolbar**<br>Highlight text to reveal a slim Read / Pause / Stop / Download pill with a full-selection progress bar. | **⏯️ Persistent MiniPlayer & Pause/Resume**<br>Docked popup player with non-destructive pause/resume and live sentence progress. |
| **✨ In-Page Spoken Highlighting**<br>Real-time sentence & word tracking on webpages with a glowing synthesis-loading pulse. | **🌐 Chirp3 & CJK Voices**<br>Full Chirp3 voice support, encoding normalization, and CJK sentence/bracket splitting. |
| **🎛️ Settings, Voice Preview & Logs**<br>Granular UI toggles, instant voice previews, and a verbose API log tab. | **📥 Updated Download Function**<br>Fixed audio download issues and added MP3, OGG, and PCM export formats. |
| **🧩 Chrome + Edge Dual Builds**<br>Simultaneous Manifest V3 packaging for Chrome & Edge with accessible, reduced-motion UI. | **🔊 Core Google Cloud TTS**<br>Supports WaveNet, Neural2, News, Studio, Polyglot voices, [SSML](https://developers.google.com/actions/reference/ssml), adjustable pitch/speed, and smart sentence chunking. |

---

## Keyboard Shortcuts

- `Cmd+Shift+S` (macOS) / `Ctrl+Shift+S` (Windows/Linux) — Read highlighted text aloud / Stop
- `Cmd+Shift+E` (macOS) / `Ctrl+Shift+E` (Windows/Linux) — Download highlighted text as audio

## Usage & Billing

- **Own API Key**: Use your own [Google Cloud API key](https://www.youtube.com/watch?v=1n8xlVNWEZ0); usage is billed directly through your Google Cloud account per their [pricing policy](https://cloud.google.com/text-to-speech/pricing).
- **Credits**: Purchase credits directly in the extension; usage is deducted per synthesis with automatic refill when empty.

---

## 🛠️ Development & Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Configure backend**:
   Run the [backend](https://github.com/pgmichael/wavenet-for-chrome-backend) locally, or update `BACKEND_URL` in [build.js](build.js) to point to the production API (`https://api.wavenet-for-chrome.com/v1`).
3. **Run in development (watch mode) or build production ZIPs**:
   ```bash
   # Development
   npm run start:extension        # Chrome
   npm run start:extension:edge   # Microsoft Edge

   # Production release packages (outputs to releases/)
   npm run build:extension        # Both Chrome & Edge
   npm run build:extension:chrome   # Chrome only
   npm run build:extension:edge     # Edge only
   ```
4. **Load in your browser**:
   Open `chrome://extensions` or `edge://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `dist/` directory.

5. **Run the website locally** *(optional)*:
   ```bash
   npm run start:website
   ```

---

## 🙏 Credits

Forked from [wavenet-for-chrome](https://github.com/pgmichael/wavenet-for-chrome) by original author **Michael Poirier-Ginter (`pgmichael`)**.  
This project is licensed under the [MIT License](LICENSE).
