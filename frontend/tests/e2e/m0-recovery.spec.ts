import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

function notices(page: Page) {
  return page.locator('.mantine-Notification-root');
}

// Texts of the notifications shown once pending requests have settled; no retry, so a second notification is counted.
async function settledNotices(page: Page) {
  await page.waitForTimeout(500);
  return notices(page).allInnerTexts();
}

async function openTone(page: Page, server: { url: string; token: string; audio: string }) {
  await page.goto(`${server.url}/?token=${server.token}`);
  await expect(page.getByLabel('Directory')).not.toHaveValue('~');
  await page.getByLabel('Directory').fill(server.audio.slice(0, server.audio.lastIndexOf('/')));
  await page.getByTitle('Browse').click();
  await page.getByRole('button', { name: '♪ tone.wav' }).dblclick();
  await expect(page.getByLabel('Waveform tone.wav')).toBeVisible();
}

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
