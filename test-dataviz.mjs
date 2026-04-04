import { writeFileSync } from 'fs'
import handler from './api/dataviz.js'

const req = {
  method: 'POST',
  body: {
    type:      'bar',
    title:     'AI Citations by Quarter',
    subtitle:  'Source: AirOps Research, 2026',
    data:      'Q1: 45\nQ2: 67\nQ3: 89\nQ4: 120',
    colorMode: 'dark',
    w:         1080,
    h:         1080,
  },
  query: {},
}

let statusCode
const headers = {}
let responseBuffer

const res = {
  setHeader: (k, v) => { headers[k] = v },
  status: (code) => { statusCode = code; return res },
  send: (buf) => { responseBuffer = buf },
  end: () => {},
  json: (obj) => { console.error('JSON response:', JSON.stringify(obj)) },
}

process.env.APP_URL = 'http://localhost:5174'
process.env.CHROMIUM_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

console.log('Generating chart... (this takes ~15s)')
const start = Date.now()

await handler(req, res)

const elapsed = ((Date.now() - start) / 1000).toFixed(1)
console.log(`Done in ${elapsed}s — status ${statusCode}`)

if (responseBuffer) {
  const out = `${process.env.HOME}/Desktop/test-dataviz.png`
  writeFileSync(out, responseBuffer)
  console.log(`Saved to ${out}`)
} else {
  console.error('No image in response')
}
