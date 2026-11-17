import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';

const require = createRequire(resolve('frontend/package.json'));
const { chromium } = require('@playwright/test');
const config = (await import('../../frontend/playwright.config.ts')).default;
if (process.argv[2] === '--browser-check') {
  const browser = await chromium.launch(config.use.launchOptions);
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      const fillRect = CanvasRenderingContext2D.prototype.fillRect;
      CanvasRenderingContext2D.prototype.fillRect = function (...args) {
        if (this.canvas.getAttribute('aria-label')?.startsWith('Waveform ')) this.canvas.dataset.drawn = 'yes';
        return fillRect.apply(this, args);
      };
    });
    await page.goto(process.argv[3]);
    await page.locator('canvas[aria-label^="Waveform "][data-drawn="yes"]').first().waitFor({ timeout: 120000 });
    await mkdir('frontend/test-results/screens', { recursive: true });
    await page.screenshot({ path: 'frontend/test-results/screens/M0-cli.png' });
    await writeFile(`${process.env.VSR_HOME}/browser-drawn`, 'drawn');
  } finally { await browser.close(); }
  process.exit(0);
}
const [audio, home, device] = process.argv.slice(2);
const server = spawn('uv', ['run', '--no-sync', 'vsr', 'serve', '--port', '0', '--no-browser', '--device', device], { env: process.env, stdio: ['ignore', 'ignore', 'pipe'] });
try {
  let ready = false;
  for await (const line of createInterface({ input: server.stderr })) {
    if (line.includes('Application startup complete.')) { ready = true; break; }
  }
  server.stderr.resume();
  if (!ready) throw new Error('Server failed to start');
  const runtime = JSON.parse(await readFile(`${home}/runtime.json`, 'utf8'));
  const browser = await chromium.launch(config.use.launchOptions);
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      const fillRect = CanvasRenderingContext2D.prototype.fillRect;
      CanvasRenderingContext2D.prototype.fillRect = function (...args) {
        if (this.canvas.getAttribute('aria-label')?.startsWith('Waveform ')) this.canvas.dataset.drawn = 'yes';
        return fillRect.apply(this, args);
      };
    });
    await page.goto(`http://127.0.0.1:${runtime.port}/?token=${runtime.token}`);
    const start = performance.now();
    const client = spawn('uv', ['run', '--no-sync', 'python', '-c', 'import webbrowser; webbrowser.open = lambda url: True; from vsr.cli import main; main()', audio], { env: process.env, stdio: 'inherit' });
    await page.locator('canvas[aria-label^="Waveform "][data-drawn="yes"]').waitFor({ timeout: 120000 });
    const elapsed = (performance.now() - start) / 1000;
    await new Promise((resolveExit, reject) => client.once('exit', code => code === 0 ? resolveExit(undefined) : reject(new Error(`CLI exited ${code}`))));
    console.log(elapsed);
  } finally { await browser.close(); }
  const launched = spawn('uv', ['run', '--no-sync', 'vsr', audio], {
    env: { ...process.env, BROWSER: `node ${resolve('tests/bench/waveform_open.ts')} --browser-check %s` },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  await new Promise((resolveExit, reject) => launched.once('exit', code => code === 0 ? resolveExit(undefined) : reject(new Error(`CLI exited ${code}`))));
  if ((await readFile(`${home}/browser-drawn`, 'utf8')) !== 'drawn') throw new Error('CLI browser did not draw');
} finally {
  server.kill('SIGTERM');
  await new Promise(resolveExit => server.once('exit', resolveExit));
}
