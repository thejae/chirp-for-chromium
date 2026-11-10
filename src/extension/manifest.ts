const isEdge = process.env.BROWSER === 'edge'

/**
 * WebExtension Manifest V3 configuration supporting both Google Chrome and
 * Microsoft Edge.
 *
 * - `key` is always preserved in `dist/manifest.json` so unpacked builds in
 *   Edge and Chrome keep a single deterministic Extension ID (`iefankigbnlnlaolflbcopliocibkffc`),
 *   preventing Edge from installing a duplicate extension or resetting
 *   `chrome.storage.sync` preferences on reload.
 * - `oauth2` is omitted on Edge builds because Edge uses
 *   `chrome.identity.launchWebAuthFlow` instead of the Chrome-only `oauth2` key.
 */
export default {
  name: 'Chirp3 for Chromium',
  description:
    'Transforms highlighted text into high-quality natural sounding audio using Google Cloud Text-to-Speech.',
  version: process.env.npm_package_version,
  key: process.env.GOOGLE_CHROME_EXTENSION_KEY,
  manifest_version: 3,
  permissions: [
    'contextMenus',
    'downloads',
    'storage',
    'activeTab',
    'scripting',
    'offscreen',
    'identity',
  ],
  ...(!isEdge && {
    oauth2: {
      client_id: process.env.GOOGLE_OAUTH2_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/userinfo.email'],
    },
  }),
  commands: {
    readAloudShortcut: {
      suggested_key: {
        default: 'Ctrl+Shift+S',
        mac: 'Command+Shift+S',
      },
      description: 'Read aloud',
    },
    downloadShortcut: {
      suggested_key: {
        default: 'Ctrl+Shift+E',
        mac: 'Command+Shift+E',
      },
      description: 'Download',
    },
  },
  background: {
    service_worker: 'service-worker.js',
    type: 'module',
  },
  host_permissions: ['<all_urls>'],
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['content-script.js'],
    },
  ],
  action: {
    default_title: 'Chirp3 for Chromium',
    default_popup: 'public/popup.html',
    default_icon: {
      16: 'public/images/icon_16.png',
      19: 'public/images/icon_19.png',
      38: 'public/images/icon_38.png',
      48: 'public/images/icon_48.png',
      128: 'public/images/icon_128.png',
    },
  },
  icons: {
    16: 'public/images/icon_16.png',
    19: 'public/images/icon_19.png',
    38: 'public/images/icon_38.png',
    48: 'public/images/icon_48.png',
    128: 'public/images/icon_128.png',
  },
  web_accessible_resources: [
    {
      resources: ['public/styles.css'],
      matches: ['<all_urls>'],
    },
  ],
  homepage_url: 'https://github.com/thejae/chirp-for-chromium',
}
