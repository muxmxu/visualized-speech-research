import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createInterface } from 'node:readline';
import config from '../../frontend/playwright.config.ts';

const { chromium } = createRequire(resolve('frontend/package.json'))('@playwright/test') as
  typeof import('../../frontend/node_modules/@playwright/test/index.js');
const [home, device, python] = process.argv.slice(2);
const env: NodeJS.ProcessEnv = { ...process.env, VSR_HOME: home };
delete env.VSR_URL;
delete env.VSR_TOKEN;

const server = spawn('uv', ['run', '--no-sync', 'vsr', 'serve', '--port', '0', '--no-browser', '--device', device], {
  env, stdio: ['ignore', 'ignore', 'pipe'],
});
const serverExit = once(server, 'exit');

try {
  let ready = false;
  for await (const line of createInterface({ input: server.stderr })) {
    if (line.includes('Application startup complete.')) {
      ready = true;
      break;
    }
  }
  server.stderr.resume();
  assert(ready, 'VSR server did not finish startup');
  const { port, token } = JSON.parse(await readFile(join(home, 'runtime.json'), 'utf8')) as { port: number; token: string };
  const url = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch(config.use?.launchOptions);
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    const handshake = once(cdp, 'Network.webSocketHandshakeResponseReceived');
    const session = page.waitForResponse(`${url}/api/session`);
    const settings = page.waitForResponse(`${url}/api/settings`);
    await page.goto(`${url}/?token=${token}`);
    assert.equal((await handshake)[0].response.status, 101);
    assert((await session).ok());
    const active = await (await settings).json();
    assert.equal(active.compute_device, device, active.reason);
    await page.getByText('Lanes', { exact: true }).waitFor();

    const sender = spawn(python, ['-c', 'import runpy; runpy.run_path("tests/bench/m2_show.py")["send"]()'], {
      env, stdio: ['pipe', 'pipe', 'inherit'],
    });
    const senderExit = once(sender, 'exit');
    const lines = createInterface({ input: sender.stdout })[Symbol.asyncIterator]();

    try {
      assert.equal((await lines.next()).value, 'ready');
      for (let run = 1; run <= 3; run++) {
        const lane = `show-benchmark-${run}`;
        const rendered = page.getByLabel(`Waveform ${lane}`, { exact: true });
        const refreshed = page.waitForResponse(`${url}/api/session`);
        const start = performance.now();
        sender.stdin.write(`${lane}\n`);
        await rendered.waitFor({ state: 'visible' });
        const ms = performance.now() - start;
        assert.equal((await lines.next()).value, 'sent');
        assert((await refreshed).ok());
        console.log(JSON.stringify({ run, device, browser: browser.version(), lane, ms }));
      }
    } finally {
      sender.stdin.end();
      const [exitCode] = await senderExit;
      assert.equal(exitCode, 0);
    }
  } finally {
    await browser.close();
  }
} finally {
  server.kill('SIGTERM');
  await serverExit;
}
