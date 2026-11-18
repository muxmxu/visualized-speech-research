import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { test, expect } from './fixtures';

const run = promisify(execFile);
const uv = ['run', '--no-sync', '--project', resolve('..')];

async function captureBrowser(home: string) {
  const browser = join(home, 'capture-browser');
  await writeFile(browser, '#!/bin/sh\nprintf "%s\\n" "$1" > "$VSR_HOME/browser-url"\n', { mode: 0o700 });
  return { ...process.env, VSR_HOME: home, BROWSER: `${JSON.stringify(browser)} %s` };
}

async function launchUrl(home: string) {
  const url = new URL((await readFile(join(home, 'browser-url'), 'utf8')).trim());
  expect(url.hash).toMatch(/^#open=[A-Za-z0-9_-]{43}$/);
  expect([...url.searchParams.keys()]).toEqual(['token']);
  return url;
}

test('confirms a tensor opened by a cold CLI from its working directory', async ({ page }) => {
  const home = await mkdtemp(join(tmpdir(), 'vsr-cold-launch-'));
  await writeFile(join(home, 'config.toml'), 'port = 0\n');
  await run('uv', [...uv, 'python', '-c', 'import numpy as np; np.save("cold.npy", np.ones(800))'], { cwd: home });
  const cli = spawn('uv', [...uv, 'vsr', '--device', 'cpu', 'cold.npy'], {
    cwd: home, env: await captureBrowser(home), stdio: ['ignore', 'ignore', 'pipe'],
  });
  try {
    const lines = createInterface({ input: cli.stderr });
    let ready = false;
    for await (const line of lines) {
      if (line.includes('Application startup complete.')) { ready = true; break; }
    }
    cli.stderr.resume();
    expect(ready).toBe(true);
    const url = await launchUrl(home);
    await page.goto(url.href);
    const dialog = page.getByRole('dialog', { name: 'Interpret tensor' });
    await expect(dialog.getByLabel('Layout')).toHaveValue('[N]');
    await dialog.getByLabel('Sample rate (Hz)').fill('8000');
    await dialog.getByRole('button', { name: 'Open tensor' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByLabel('Waveform cold.npy', { exact: true })).toBeVisible();
    await expect(page.locator('.lane')).toHaveCount(1);
    expect(page.url()).toBe(`${url.origin}/`);
  } finally {
    if (cli.exitCode === null && cli.signalCode === null) {
      const exited = once(cli, 'exit');
      cli.kill('SIGTERM');
      await exited;
    }
    await rm(home, { recursive: true, force: true });
  }
});

test('claims a warm mixed CLI batch in argv order and clears launch history', async ({ page, server }, testInfo) => {
  const home = dirname(server.audio);
  const cwd = join(home, 'cli files');
  await mkdir(cwd);
  await run('uv', [...uv, 'python', '-c',
    'import numpy as np; np.save("cancel.npy", np.ones(400)); np.savez("choose.npz", private_audio_leaf=np.ones(800), private_feature_leaf=np.ones((16, 40)))',
  ], { cwd });
  const previous = `${server.url}/?before=1`;
  await page.goto(`${previous}&token=${server.token}`);
  const dialog = page.getByRole('dialog', { name: 'Interpret tensor' });
  await run('uv', [...uv, 'vsr', 'cancel.npy', '../tone.wav', '--device', 'cpu', 'choose.npz'], {
    cwd, env: await captureBrowser(home),
  });
  await expect(dialog).toBeHidden();
  await expect(page.locator('.lane')).toHaveCount(0);

  const url = await launchUrl(home);
  expect(url.origin).toBe(server.url);
  url.searchParams.set('keep', '1');
  const current = `${server.url}/?keep=1`;
  const claims: { page: string; body: string | null; auth: string; id: string }[] = [];
  await page.route('**/api/open', async route => {
    const request = route.request();
    const headers = request.headers();
    claims.push({ page: request.frame().url(), body: request.postData(), auth: headers.authorization, id: headers['x-vsr-open-launch'] });
    await route.continue();
  });
  await page.goto(url.href);
  await expect(page).toHaveURL(current);
  await expect(dialog).toContainText('[400]');
  await expect(page.getByLabel('Waveform tone.wav', { exact: true })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await dialog.getByRole('button', { name: /private_feature_leaf/ }).click();
  await expect(dialog.getByLabel('Kind')).toHaveValue('feature');
  await expect(dialog).toContainText('[16, 40]');
  await page.screenshot({ path: testInfo.outputPath('M2-warm-cli-tensor-dialog.png') });
  await dialog.getByRole('button', { name: 'Open tensor' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel('Feature choose.npz', { exact: true })).toBeVisible();
  await expect(page.locator('.lane')).toHaveCount(2);

  await page.reload();
  await expect(page.locator('.lane')).toHaveCount(2);
  await page.goBack();
  await expect(page).toHaveURL(previous);
  await page.goForward();
  await expect(page).toHaveURL(current);
  await expect(page.locator('.lane')).toHaveCount(2);
  await expect(dialog).toBeHidden();
  expect(claims).toEqual([{
    page: current, body: '{"paths":[]}', auth: `Bearer ${server.token}`, id: url.hash.slice(6),
  }]);
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  for (const secret of [home, 'cancel.npy', 'choose.npz', 'tone.wav', 'private_audio_leaf', 'private_feature_leaf', url.hash.slice(6)]) {
    expect(storage).not.toContain(secret);
  }
});
