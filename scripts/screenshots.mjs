import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Captures the docs/screenshots/ set by driving headless Chrome over the DevTools protocol.
// Usage: node scripts/screenshots.mjs [pageUrl] [outDir]     (needs Node 22+ for global WebSocket)
// Set CHROME_PATH if Chrome isn't in a standard location.
const here = dirname(fileURLToPath(import.meta.url));
const pageUrl = process.argv[2] || pathToFileURL(resolve(here, '..', 'index.html')).href;
const outDir = process.argv[3] || resolve(here, '..', 'docs', 'screenshots');
const chrome = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => p && existsSync(p));
if (!chrome) throw new Error('Chrome not found. Set CHROME_PATH.');
const port = 9333;
const profile = mkdtempSync(join(tmpdir(), 'aether-shot-'));
const proc = spawn(chrome, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--autoplay-policy=no-user-gesture-required', 'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.find(t => t.type === 'page')) break; } catch {}
  await sleep(200);
}
const page = targets.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = expr => send('Runtime.evaluate', { expression: expr, awaitPromise: true });
const click = async (x, y) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};
const shot = async name => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(outDir, name), Buffer.from(r.result.data, 'base64'));
  console.log('saved', name);
};
const view = (w, h, mobile = false) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
const load = async (w, h, mobile = false) => {
  await view(w, h, mobile);
  await send('Page.navigate', { url: pageUrl });
  await sleep(3500); // fonts + first settle
};
const world = async n => { await ev(`document.querySelector('[data-world="${n}"]').click()`); await sleep(4500); };
const palette = async n => { await ev(`document.querySelector('[data-palette="${n}"]').click()`); await sleep(400); };

await send('Page.enable'); await send('Runtime.enable');

// Desktop 1440x900: five worlds
await load(1440, 900);
await shot('01-galaxy.png');
for (const [n, name] of [[1, '02-sphere'], [2, '03-wave'], [3, '04-bloom'], [4, '05-orbit']]) { await world(n); await shot(`${name}.png`); }

// Atmospheres
await world(0); await ev(`document.getElementById('tune').click()`); await sleep(400);
await shot('06-tune-panel.png');
await palette(1); await sleep(1500); await shot('07-atmosphere-ember.png');
await palette(2); await world(3); await shot('08-atmosphere-glacier-bloom.png');
await palette(3); await world(1); await shot('09-atmosphere-rose-sphere.png');

// Ripple (fresh load so the settings panel is closed)
await load(1440, 900);
await click(1000, 420); await sleep(450); await click(700, 560); await sleep(500);
await shot('10-ripple.png');

// Guide dialog
await ev(`document.getElementById('help').click()`); await sleep(700);
await shot('11-guide.png');

// Mobile 390x844
await load(390, 844, true);
await shot('12-mobile-galaxy.png');
await world(3); await shot('13-mobile-bloom.png');

ws.close(); proc.kill();
process.exit(0);
