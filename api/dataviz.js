import chromium from '@sparticuz/chromium-min'
import puppeteer from 'puppeteer-core'

const CHROMIUM_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v130.0.0/chromium-v130.0.0-pack.tar'

// Encode matching the decode in index.html loadFromQuery:
//   JSON.parse(decodeURIComponent(escape(atob(b64))))
function encodeQueryPayload(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const {
    type       = 'bar',
    title      = '',
    subcopy    = '',
    subtitle   = '',
    data       = '',
    colorMode  = 'light',
    layout     = 'standard',
    painting,
    w          = 1080,
    h          = 1080,
    showLogo   = true,
    showSource = true,
  } = req.body ?? {}

  const appUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  if (!appUrl) {
    return res.status(500).json({ error: 'APP_URL env var is not configured' })
  }

  const encoded = encodeQueryPayload({ type, title, subcopy, subtitle, data, colorMode, layout, painting, w, h, showLogo, showSource })
  const targetUrl = `${appUrl}/?data=${encoded}`

  const executablePath =
    process.env.CHROMIUM_PATH ||
    (await chromium.executablePath(CHROMIUM_URL))

  const isLocalChrome = !!process.env.CHROMIUM_PATH
  const args = isLocalChrome
    ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    : chromium.args

  let browser
  try {
    browser = await puppeteer.launch({
      args,
      defaultViewport: { width: 1440, height: 900 },
      executablePath,
      headless: true,
    })

    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900 })

    // networkidle0 ensures fonts and painting images are fully loaded
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 })

    // Wait for chart SVG to be rendered
    await page.waitForFunction(
      () => !!document.querySelector('#chart-canvas svg'),
      { timeout: 15000 },
    )

    // Call the exposed export helper to get full-resolution PNG data URL
    const dataUrl = await page.evaluate(() => window.__exportToDataURL())

    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    const buffer = Buffer.from(base64, 'base64')

    if (req.query?.format === 'json') {
      return res.status(200).json({ image: base64 })
    }

    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('Content-Disposition', `inline; filename="airops-dataviz-${type}-${w}x${h}.png"`)
    return res.status(200).send(buffer)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  } finally {
    if (browser) await browser.close()
  }
}
