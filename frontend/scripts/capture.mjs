/*
 * Screenshot capture for the finish review.
 *
 * Drives headless Chrome over CDP rather than using --screenshot, because the
 * app is behind a session: the browser has to sign in as the demo member and
 * navigate to a trip before there is anything worth capturing.
 *
 * Entrance motion is allowed to settle before each shot. A gauge caught
 * mid-sweep reads as a wrong value to a reviewer, and gets "fixed" into a
 * regression.
 *
 *   node scripts/capture.mjs [baseUrl] [outDir]
 */

import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173'
const OUT = process.argv[3] ?? '.impeccable/review'
const PORT = 9333

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]

const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chromePath) {
  console.error('No Chrome or Edge found.')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Minimal CDP client: send a method, await the reply with the matching id. */
function cdp(ws) {
  let nextId = 1
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    }
  })
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params }))
    })
}

const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    `--user-data-dir=${path.join(process.cwd(), '.impeccable', 'chrome-profile')}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

process.on('exit', () => chrome.kill())

async function targetUrl() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await res.json()
      const page = targets.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      // Chrome is still starting.
    }
    await sleep(250)
  }
  throw new Error('Chrome did not expose a debugging target.')
}

const ws = new WebSocket(await targetUrl())
await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))
const send = cdp(ws)

await send('Page.enable')
await send('Runtime.enable')

const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  return result.result?.value
}

async function shoot(name, width, height, url) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: width < 768,
  })
  await send('Page.navigate', { url })
  await sleep(2600)

  // Sign in as the demo member the first time round.
  await evaluate(`(async () => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Try the demo trip'));
    if (btn) { btn.click(); await new Promise((r) => setTimeout(r, 2600)); }
    return location.pathname;
  })()`)

  if (url !== BASE) {
    await evaluate(`(async () => {
      history.pushState({}, '', ${JSON.stringify(new URL(url).pathname)});
      window.dispatchEvent(new PopStateEvent('popstate'));
      await new Promise((r) => setTimeout(r, 2600));
    })()`)
  }

  // Let the power-on sweep finish so no gauge is captured mid-travel.
  await sleep(1600)

  /*
   * A sticky element sits at the viewport edge, so in a full-page capture it
   * lands in the middle of the image over whatever happens to be there. Pinning
   * it static for the shot gives an honest picture of the document instead of
   * an artifact a reviewer would try to fix.
   */
  await evaluate(`(() => {
    document.getElementById('capture-style')?.remove();
    const style = document.createElement('style');
    style.id = 'capture-style';
    style.textContent = '*{animation:none!important} header,nav,form{position:static!important}';
    document.head.appendChild(style);
    return true;
  })()`)
  await sleep(300)

  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  })
  const file = path.join(OUT, `${name}.png`)
  await writeFile(file, Buffer.from(data, 'base64'))
  console.log(`${file}  ${width}x${height}`)
}

await mkdir(OUT, { recursive: true })

const shots = [
  ['desktop', 1440, 900, `${BASE}/trips/trip-gor`],
  ['mobile', 390, 844, `${BASE}/trips/trip-gor`],
  ['desktop-money', 1440, 900, `${BASE}/trips/trip-gor/expenses`],
  ['mobile-money', 390, 844, `${BASE}/trips/trip-gor/expenses`],
  ['desktop-voting', 1440, 900, `${BASE}/trips/trip-gor/voting`],
  ['mobile-fuel', 390, 844, `${BASE}/trips/trip-gor/fuel`],
  ['desktop-calendar', 1440, 900, `${BASE}/trips/trip-gor/calendar`],
  ['mobile-chat', 390, 844, `${BASE}/trips/trip-gor/chat`],
  ['mobile-login', 390, 844, `${BASE}/login`],
]

for (const [name, w, h, url] of shots) {
  await shoot(name, w, h, url)
}

ws.close()
chrome.kill()
process.exit(0)
