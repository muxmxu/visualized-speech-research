import type { Page, WebSocketRoute } from '@playwright/test';
import { test, expect } from './fixtures';

const panelTitles = ['Lanes', 'Files', 'Properties', 'Settings', 'Display', 'Dataset', 'Analyzers', 'Frequency Analysis', 'Record', 'RIR'];

function notices(page: Page) {
  return page.locator('.mantine-Notification-root');
}

// Texts of the notifications shown once pending requests have settled; no retry, so a second notification is counted.
async function settledNotices(page: Page) {
  await page.waitForTimeout(500);
  return notices(page).allInnerTexts();
}

async function expectWorkspace(page: Page) {
  await expect(page.locator('#root .dock')).toBeAttached();
  await expect(page.locator('.lanes')).toBeVisible();
  const titles = await page.locator('.dv-tab .dv-default-tab-content').allTextContents();
  expect([...titles].sort()).toEqual([...panelTitles].sort());
}

async function openTone(page: Page, server: { url: string; token: string; audio: string }) {
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(page.getByLabel('Directory')).not.toHaveValue('~');
  await page.getByLabel('Directory').fill(server.audio.slice(0, server.audio.lastIndexOf('/')));
  await page.getByTitle('Browse').click();
  await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  await expect(page.getByLabel('Waveform tone.wav')).toBeVisible();
}

test('restores every panel when the saved layout lacks Lanes and Dataset', async ({ page, server }) => {
  await page.goto(`${server.url}/?token=${server.token}`);
  await expectWorkspace(page);
  for (const title of ['Dataset', 'Lanes']) {
    const tab = page.locator('.dv-tab').filter({ has: page.getByText(title, { exact: true }) });
    await tab.click();
    await tab.locator('.dv-default-tab-action').click();
    await expect(tab).toHaveCount(0);
  }
  const layout = await page.evaluate(() => localStorage.getItem('vsr-layout'));
  expect(layout).not.toContain('"lanes"');
  await page.addInitScript(value => localStorage.setItem('vsr-layout', value), layout as string);
  await page.reload();
  await expectWorkspace(page);
  expect(await settledNotices(page)).toEqual([]);
});

for (const saved of ['{}', 'not json']) {
  test(`resets a saved layout ${JSON.stringify(saved)} to the default with one notification`, async ({ page, server }) => {
    await page.addInitScript(value => localStorage.setItem('vsr-layout', value), saved);
    await page.goto(`${server.url}/?token=${server.token}`);
    await expectWorkspace(page);
    await expect(notices(page).filter({ hasText: 'Saved layout was reset' })).toHaveCount(1);
    expect(await settledNotices(page)).toHaveLength(1);
  });
}

for (const saved of ['null', '{}', '[{"path":"/a.wav"}]', '["/a.wav",1]', 'not json']) {
  test(`treats a stored recent list ${saved} that is not an array of strings as empty`, async ({ page, server }) => {
    await page.addInitScript(value => localStorage.setItem('vsr-recent', value), saved);
    await page.goto(`${server.url}/?token=${server.token}`);
    await expectWorkspace(page);
    await expect(page.getByLabel('Directory')).not.toHaveValue('~');
    await expect(page.locator('.files-panel .file')).toHaveCount(0);
  });
}

test('refreshes the session when the WebSocket opens after a lane change was broadcast', async ({ page, server }) => {
  let connect: () => void = () => undefined;
  const opened = new Promise<void>(resolve => { connect = resolve; });
  await page.routeWebSocket('**/ws?*', async route => { await opened; route.connectToServer(); });
  const session = page.waitForResponse(response => new URL(response.url()).pathname === '/api/session');
  await page.goto(`${server.url}/?token=${server.token}`);
  expect(await (await session).json()).toEqual({ lanes: [] });
  const result = await page.request.post(`${server.url}/api/open`, { headers: { Authorization: `Bearer ${server.token}` }, data: { paths: [server.audio] } });
  expect(result.ok()).toBe(true);
  connect();
  await expect(page.getByLabel('Waveform tone.wav')).toBeVisible();
});

test('shows a lasting notification when the WebSocket closes', async ({ page, server }) => {
  const socket = {} as { route: WebSocketRoute };
  await page.routeWebSocket('**/ws?*', route => { socket.route = route; route.connectToServer(); });
  await page.goto(`${server.url}/?token=${server.token}`);
  await expectWorkspace(page);
  await expect.poll(() => socket.route).toBeDefined();
  expect(await settledNotices(page)).toEqual([]);
  await socket.route.close();
  await expect(notices(page).filter({ hasText: 'Connection to the vsr server was lost' })).toHaveCount(1);
  await page.waitForTimeout(5000);
  expect(await settledNotices(page)).toHaveLength(1);
});

test('hiding the Lanes panel requests no zero-width waveform', async ({ page, server }) => {
  await openTone(page, server);
  const failures: string[] = [];
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  const waveforms: string[] = [];
  page.on('request', request => { if (request.url().includes('/waveform?')) waveforms.push(request.url()); });
  await page.locator('.dv-tab').getByText('Dataset', { exact: true }).click();
  await expect(page.getByLabel('Waveform tone.wav')).toBeHidden();
  expect(await settledNotices(page)).toEqual([]);
  expect(failures).toEqual([]);
  for (const url of waveforms) {
    const query = new URL(url).searchParams;
    expect(Number(query.get('width'))).toBeGreaterThan(1);
    expect(Number(query.get('t1'))).toBeGreaterThan(Number(query.get('t0')));
  }
  await page.locator('.dv-tab').getByText('Lanes', { exact: true }).click();
  await expect(page.getByLabel('Waveform tone.wav')).toBeVisible();
  await expect.poll(() => waveforms.length).toBeGreaterThan(0);
  expect(await settledNotices(page)).toEqual([]);
  expect(failures).toEqual([]);
});

const failure = { status: 500, json: { error: 'Injected failure', detail: 'injected for the test', traceback: null } };

test('a failed request at startup shows one notification', async ({ page, server }) => {
  await page.route('**/api/settings', route => route.fulfill(failure));
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(notices(page).filter({ hasText: 'injected for the test' }).first()).toBeVisible();
  expect(await settledNotices(page)).toHaveLength(1);
});

test('a failed spectrogram request shows one notification', async ({ page, server }) => {
  let failed = false;
  await page.route('**/spectrogram?*', route => { if (failed) return route.continue(); failed = true; return route.fulfill(failure); });
  await openTone(page, server);
  await expect.poll(() => failed).toBe(true);
  await expect(notices(page).filter({ hasText: 'injected for the test' }).first()).toBeVisible();
  expect(await settledNotices(page)).toHaveLength(1);
});
