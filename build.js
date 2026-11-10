import { execSync } from 'child_process'
import { mkdirSync, readFileSync, rmSync, watch, writeFileSync } from 'fs'
import { createManifest } from './src/extension/manifest'

/**
 * Parse CLI flags (`--environment=development|production`, `--browser=chrome|edge|all`).
 * When `--browser` is omitted in production (`npm run build:extension`), builds
 * both `chrome` and `edge` simultaneously.
 */
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')),
)
const environment = args.environment || 'development'
const explicitBrowser = args.browser
const targetBrowsers =
  explicitBrowser && explicitBrowser !== 'all'
    ? [explicitBrowser]
    : environment === 'production'
    ? ['chrome', 'edge']
    : ['chrome']

const packageVersion =
  process.env.npm_package_version ||
  JSON.parse(readFileSync('./package.json', 'utf8')).version

// Setup environment variables for the frontend
const SHARED_ENVIRONMENT_VARIABLES = {
  TTS_API_URL: 'https://texttospeech.googleapis.com/v1beta1',
  GOOGLE_OAUTH2_CLIENT_ID:
    '89959520704-p0jas87qkq9u8tmjs0d0c6sopiajl0kl.apps.googleusercontent.com',
  GOOGLE_CHROME_EXTENSION_KEY:
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv8jZ7956T275KyNvf6hU4JqqEb4e2sWrJXtZh2k2wR/3t36QLA+BmI3vCOxrdK8wlCmF1vs+I0NgzeYlIE27QEIjYen8s6wBM8jHAicGqSu/N9WFbJ1W3e2I5t4RmMpZXw4YtDplof6Niy7mcFoCwKuUKxkH14WjOLSn+eQSsV2QoFePua0qGypmxCsoZ0nJleshRPd/5y52/xJTTlQ3USgQZuwc37nTzxEI34XXlV/N3lrJtJFJ6uLFqgU8FNFBozsrmTcrVnieLBSsMpqG8+EpKbeJoEK02xr6N4YOhXBFqSQ6jXJ5+E7PQNJmenOwa8w2VSIMVXtnOG0XFPfQtwIDAQAB',
  npm_package_version: packageVersion,
}

const PRODUCTION_ENVIRONMENT_VARIABLES = {
  ENVIRONMENT: 'production',
  BACKEND_URL: 'https://api.wavenet-for-chrome.com/v1',
}

const DEVELOPMENT_ENVIRONMENT_VARIABLES = {
  ENVIRONMENT: 'development',
  BACKEND_URL:
    process.env.BACKEND_URL || 'https://api.wavenet-for-chrome.com/v1',
}

const BASE_ENVIRONMENT_VARIABLES =
  environment === 'production'
    ? { ...SHARED_ENVIRONMENT_VARIABLES, ...PRODUCTION_ENVIRONMENT_VARIABLES }
    : { ...SHARED_ENVIRONMENT_VARIABLES, ...DEVELOPMENT_ENVIRONMENT_VARIABLES }

process.env = { ...process.env, ...BASE_ENVIRONMENT_VARIABLES }

// If we're in development, watch the src folder for changes and rebuild
if (environment === 'development') {
  const devBrowser = targetBrowsers[0]
  console.log(`🛠️  Building for development environment (${devBrowser})\n`)
  rmSync('dist', { recursive: true, force: true })
  mkdirSync('dist', { recursive: true })

  await buildForBrowser(devBrowser, 'dist')
  console.log(
    '✅ Extension ready in ./dist — load unpacked in edge://extensions or chrome://extensions',
  )
  console.log('👀 Watching src/ for changes (press Ctrl+C to stop)...\n')
  let rebuildTimer = null
  watch('src', { recursive: true }, () => {
    if (rebuildTimer) clearTimeout(rebuildTimer)
    rebuildTimer = setTimeout(() => buildForBrowser(devBrowser, 'dist'), 150)
  })
}

// If we're in production, build each target browser and zip it up in releases/
if (environment === 'production') {
  console.log(
    `🛠️  Building for production environment (${targetBrowsers.join(' + ')})\n`,
  )
  mkdirSync('releases', { recursive: true })

  for (const browser of targetBrowsers) {
    const outDir = targetBrowsers.length > 1 ? `dist-${browser}` : 'dist'
    rmSync(outDir, { recursive: true, force: true })
    mkdirSync(outDir, { recursive: true })

    await buildForBrowser(browser, outDir)

    const releaseName = `chirp3-for-${browser}-${packageVersion}`
    console.time(`✅ Zipped up release ${releaseName}`)
    execSync(
      `rm -f releases/${releaseName}.zip && (command -v zip >/dev/null 2>&1 && zip -r releases/${releaseName}.zip ${outDir} || python3 -m zipfile -c releases/${releaseName}.zip ${outDir})`,
    )
    console.timeEnd(`✅ Zipped up release ${releaseName}`)
    console.log('')

    // When building both Chrome and Edge, keep `./dist` synced with the Edge
    // (or final) build so unpacked extensions loaded from `./dist` stay updated,
    // and clean up temporary `dist-${browser}` staging directories.
    if (outDir !== 'dist') {
      rmSync('dist', { recursive: true, force: true })
      execSync(`cp -r ${outDir} dist`)
      rmSync(outDir, { recursive: true, force: true })
    }
  }
}

// functions --------------------------------------------------------------
async function buildForBrowser(browser, outDir = 'dist') {
  console.time(`✅ Built extension (${browser})`)

  const envVars = { ...BASE_ENVIRONMENT_VARIABLES, BROWSER: browser }
  const define = Object.entries(envVars).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [`process.env.${key}`]: JSON.stringify(value),
    }),
    {},
  )

  const output = await Bun.build({
    entrypoints: [
      'src/extension/extension.tsx',
      'src/extension/popup.tsx',
      'src/extension/content-script.tsx',
      'src/extension/service-worker.ts',
      'src/extension/offscreen.ts',
    ],
    define,
    outdir: outDir,
  })

  if (!output.success) {
    console.error(output)
  }

  console.time('ℹ️ Copied public folder')
  execSync(`cp -r src/extension/public ${outDir}`)
  console.timeEnd('ℹ️ Copied public folder')

  console.time('ℹ️ Built manifest')
  const manifest = createManifest(browser)
  writeFileSync(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2))
  console.timeEnd('ℹ️ Built manifest')

  console.time('ℹ️ Built css')
  execSync(
    `"${process.execPath}" ./node_modules/tailwindcss/lib/cli.js -i ./src/extension/public/styles.css -o ./${outDir}/public/styles.css`,
  )
  console.timeEnd('ℹ️ Built css')
  console.timeEnd(`✅ Built extension (${browser})`)

  if (environment === 'development') console.log('')
}
