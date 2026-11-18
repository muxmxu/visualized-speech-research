import { utimes, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { decodeFrame } from '../../src/api/frame';
import type { FrameArray } from '../../src/api/frame';
import type { AnalyzerLaneResult, CurveLane, FeatureLane, Lane, WorkspaceLane } from '../../src/api/types';
import { test, expect } from './fixtures';

function scalarPlugin(base: number) {
  return `from vsr.api import Param, Scalars, analyzer

@analyzer(id="fixture.scalars", label="Fixture Scalars", version=1, input="audio")
def metrics(x, sr, *, index=Param(0, min=0, max=9, label="Index"),
            stop=Param(False, label="Raise error"), threshold=Param(0.5, min=0, max=1, step=0.1),
            metric=Param("score"), mode=Param("plain", choices=["plain", "other"])):
    if stop:
        raise RuntimeError("fixture analyzer failure")
    return Scalars({metric: index + ${base}})
`;
}

const plugins = {
  image: `import torch
from vsr.api import TimeFreqImage, analyzer

@analyzer(id="fixture.image", label="Fixture Image", version=1, input="audio")
def image(x, sr):
    values = torch.linspace(0.05, 1, 129 * 51).reshape(129, 51)
    return TimeFreqImage(values, 100, 0, {"type": "linear", "f_max": sr / 2}, "magnitude")
`,
  curve: `import torch
from vsr.api import TimeCurve, analyzer

@analyzer(id="fixture.curve", label="Fixture Curve", version=1, input="audio")
def curve(x, sr):
    return TimeCurve(torch.tensor([0.0, 0.2, 0.4]), torch.tensor([[0.0, 1.0, 2.0], [2.0, float("nan"), 0.0]]),
                     "level", labels=["Rise", "Gap"])
`,
  events: `from vsr.api import Events, analyzer

@analyzer(id="fixture.events", label="Fixture Events", version=1, input="audio")
def events(x, sr):
    return Events([(0.04, 0.25, "First event"), (0.32, 0.48, "Second event")])
`,
  spectrum: `import torch
from vsr.api import Spectrum, analyzer

@analyzer(id="fixture.spectrum", label="Fixture Spectrum", version=1, input="audio")
def spectrum(x, sr):
    return Spectrum(torch.tensor([100.0, 200.0, 300.0, 400.0]), torch.tensor([[1.0, 2.0, 3.0, 4.0], [4.0, 3.0, 2.0, 1.0]]),
                    "relative power", labels=["Rising bins", "Falling bins"])
`,
  audio: `import torch
from vsr.api import Audio, analyzer

@analyzer(id="fixture.audio", label="Fixture Audio", version=1, input="audio")
def audio(x, sr):
    return Audio(torch.full((1, 400), 0.25), 8000)
`,
};

test('runs and reloads real analyzer plugins and displays all six output types', async ({ page, server }) => {
  test.setTimeout(90_000);
  const authorization = { Authorization: `Bearer ${server.token}` };
  await page.setViewportSize({ width: 1440, height: 960 });
  const opened = await page.request.post(`${server.url}/api/open`, { headers: authorization, data: { paths: [server.audio] } });
  expect(opened.ok()).toBe(true);
  const { lanes: [source] } = await opened.json() as { lanes: Lane[] };
  const scalarPath = join(server.plugins, 'scalars.py');
  await page.goto(`${server.url}/?token=${server.token}`);
  await page.locator('.dock').getByText('Analyzers', { exact: true }).click();
  const panel = page.getByRole('region', { name: 'Analyzers panel' });
  const selector = panel.getByRole('combobox', { name: 'Analyzer', exact: true });
  await expect(panel.getByText(source.name, { exact: true })).toBeVisible();
  await expect(selector.locator('option[value="f0"]')).toHaveCount(1);
  await Promise.all([
    writeFile(scalarPath, scalarPlugin(0.25)),
    ...Object.entries(plugins).map(([name, code]) => writeFile(join(server.plugins, `${name}.py`), code)),
  ]);
  await panel.getByRole('button', { name: 'Refresh analyzer list' }).click();
  await expect(selector.locator('option[value="fixture.scalars"]')).toHaveCount(1);

  async function run(id: string) {
    const response = page.waitForResponse(`**/api/analyzers/${id}/run`);
    await panel.getByRole('button', { name: 'Run', exact: true }).click();
    return await response;
  }

  async function sessionLane(id: string): Promise<WorkspaceLane> {
    const response = await page.request.get(`${server.url}/api/session`, { headers: authorization });
    expect(response.ok()).toBe(true);
    const { lanes } = await response.json() as { lanes: WorkspaceLane[] };
    const lane = lanes.find(item => item.id === id);
    if (!lane) throw new Error(`No session lane ${id}`);
    return lane;
  }

  const laneRow = (id: string) => page.locator(`.lane[data-lane-id="${id}"]`);
  await page.getByLabel('Directory', { exact: true }).fill(dirname(server.audio));
  await page.getByTitle('Browse').click();
  await expect(page.getByRole('button', { name: '♪ tone.wav' })).toBeVisible();
  await page.getByLabel('End', { exact: true }).fill('0.4');
  await page.getByLabel('Start', { exact: true }).fill('0.1');
  await selector.selectOption('fixture.scalars');
  await panel.getByLabel('Input channel').selectOption('0');
  await panel.getByLabel('Index').fill('1');
  const first = await run('fixture.scalars');
  expect(first.ok()).toBe(true);
  expect(first.request().postDataJSON()).toEqual({
    lane: source.id, t0: 0.1, t1: 0.4, channel: 0, params: { index: 1, stop: false, threshold: 0.5, metric: 'score', mode: 'plain' },
  });
  await expect(panel.getByRole('table', { name: 'Scalar results' })).toContainText('1.25');
  await writeFile(scalarPath, scalarPlugin(1.25));
  const edited = new Date(Date.now() + 2000);
  await utimes(scalarPath, edited, edited);
  const second = await run('fixture.scalars');
  expect(second.ok()).toBe(true);
  expect(second.request().postDataJSON()).toEqual(first.request().postDataJSON());
  await expect(panel.getByRole('table', { name: 'Scalar results' })).toContainText('2.25');

  await panel.getByLabel('Raise error').check();
  const failed = await run('fixture.scalars');
  expect(failed.status()).toBe(500);
  await page.getByText('Traceback', { exact: true }).click();
  await expect(page.locator('.api-traceback pre')).toContainText('RuntimeError: fixture analyzer failure');

  await laneRow(source.id).getByLabel(`Spectrogram ${source.name}`).click({ position: { x: 20, y: 20 } });
  await expect(panel.getByText('Whole lane')).toBeVisible();
  await selector.selectOption('fixture.image');
  const image = await run('fixture.image');
  expect(image.ok()).toBe(true);
  const { lanes: [imageId], kind: imageKind } = await image.json() as AnalyzerLaneResult;
  expect(imageKind).toBe('time_freq_image');
  const imageLane = await sessionLane(imageId) as FeatureLane;
  expect(imageLane).toMatchObject({ kind: 'feature', parent: source.id, rows: 129, frames: 51, frame_rate: 100, value_scale: 'magnitude' });
  await expect(laneRow(imageId).getByLabel(`Feature ${imageLane.name}`, { exact: true })).toBeVisible();
  const pixels = await page.request.get(`${server.url}/api/lanes/${imageId}/spectrogram?t0=0&t1=0.51&width=200&f_lo=0&f_hi=128`, { headers: authorization });
  expect(pixels.ok()).toBe(true);
  expect((decodeFrame(Uint8Array.from(await pixels.body()).buffer).arrays as FrameArray).shape).toEqual([129, 51]);

  await selector.selectOption('fixture.curve');
  const curve = await run('fixture.curve');
  expect(curve.ok()).toBe(true);
  const { lanes: [curveId] } = await curve.json() as AnalyzerLaneResult;
  const curveData = await page.request.get(`${server.url}/api/lanes/${curveId}/data`, { headers: authorization });
  expect(curveData.ok()).toBe(true);
  const { arrays: curveArrays } = decodeFrame(Uint8Array.from(await curveData.body()).buffer);
  const curves = curveArrays as Record<string, FrameArray>;
  expect(curves.times.shape).toEqual([3]);
  expect(curves.values.shape).toEqual([2, 3]);
  expect(curves.values.data[4]).toBeNaN();
  const curvePlot = laneRow(curveId).getByRole('img', { name: /^Curves/ });
  await expect(curvePlot).toHaveAttribute('data-curve-count', '2');
  await expect(curvePlot).toHaveAttribute('data-point-count', '3');
  await expect(laneRow(curveId).getByText('Rise', { exact: true })).toBeVisible();
  await expect(laneRow(curveId).getByText('Gap', { exact: true })).toBeVisible();

  await selector.selectOption('fixture.events');
  const events = await run('fixture.events');
  expect(events.ok()).toBe(true);
  const { lanes: [eventId] } = await events.json() as AnalyzerLaneResult;
  const eventData = await page.request.get(`${server.url}/api/lanes/${eventId}/data`, { headers: authorization });
  expect(await eventData.json()).toEqual({ items: [[0.04, 0.25, 'First event'], [0.32, 0.48, 'Second event']] });
  const eventPlot = laneRow(eventId).getByRole('img', { name: /First event, Second event/ });
  await expect(eventPlot).toHaveAttribute('data-event-count', '2');
  await expect(eventPlot).toBeVisible();

  await selector.selectOption('fixture.spectrum');
  const spectrum = await run('fixture.spectrum');
  expect(spectrum.ok()).toBe(true);
  const { header, arrays: spectrumArrays } = decodeFrame(Uint8Array.from(await spectrum.body()).buffer);
  expect(header).toMatchObject({ kind: 'spectrum', lanes: [], result: { unit: 'relative power', labels: ['Rising bins', 'Falling bins'] } });
  const bins = spectrumArrays as Record<string, FrameArray>;
  expect(bins.freqs.shape).toEqual([4]);
  expect(bins.values.shape).toEqual([2, 4]);
  const spectrumPlot = page.getByLabel('Frequency analysis plot');
  await expect(spectrumPlot).toHaveAttribute('data-unit', 'relative power');
  await expect(spectrumPlot).toHaveAttribute('data-series-count', '2');
  await expect(spectrumPlot).toHaveAttribute('data-point-count', '4');
  await expect(spectrumPlot.getByText('Rising bins', { exact: true })).toBeVisible();
  await expect(spectrumPlot.getByText('Falling bins', { exact: true })).toBeVisible();

  await selector.selectOption('fixture.audio');
  const audio = await run('fixture.audio');
  expect(audio.ok()).toBe(true);
  const { lanes: [audioId] } = await audio.json() as AnalyzerLaneResult;
  const audioLane = await sessionLane(audioId) as Lane;
  expect(audioLane).toMatchObject({ kind: 'audio', parent: source.id, channels: 1, samples: 400, sr: 8000 });
  await expect(laneRow(audioId).getByLabel(`Waveform ${audioLane.name}`, { exact: true })).toBeVisible();
  const pcm = await page.request.get(`${server.url}/api/lanes/${audioId}/pcm?t0=0&t1=0.05&sr=8000`, { headers: authorization });
  expect(pcm.ok()).toBe(true);
  expect((decodeFrame(Uint8Array.from(await pcm.body()).buffer).arrays as FrameArray).shape).toEqual([1, 400]);

  await selector.selectOption('f0');
  const pitch = await run('f0');
  expect(pitch.ok()).toBe(true);
  const { lanes: [pitchId] } = await pitch.json() as AnalyzerLaneResult;
  const pitchLane = await sessionLane(pitchId) as CurveLane;
  expect(pitchLane).toMatchObject({ kind: 'curve', parent: source.id, overlay: true });
  const pitchData = await page.request.get(`${server.url}/api/lanes/${pitchId}/data`, { headers: authorization });
  const { arrays: pitchArrays } = decodeFrame(Uint8Array.from(await pitchData.body()).buffer);
  const points = (pitchArrays as Record<string, FrameArray>).times.shape[0];
  expect(points).toBeGreaterThan(0);
  const overlay = laneRow(source.id).getByLabel('Analyzer overlays');
  await expect(overlay.getByRole('button')).toHaveCount(1);
  await expect(laneRow(source.id).getByRole('img', { name: /^Curves/ })).toHaveAttribute('data-point-count', String(points));
  await expect(laneRow(pitchId)).toHaveCount(0);

  await laneRow(imageId).getByLabel(`Feature ${imageLane.name}`, { exact: true }).click({ position: { x: 20, y: 20 } });
  await selector.selectOption('griffinlim');
  await panel.getByLabel('FFT size (0 = auto)', { exact: true }).fill('256');
  await panel.getByLabel('Hop (0 = source) (samples)', { exact: true }).fill('80');
  const inverted = await run('griffinlim');
  expect(inverted.ok()).toBe(true);
  expect(inverted.request().postDataJSON()).toMatchObject({ lane: imageId, params: { n_fft: 256, hop: 80 } });
  const { lanes: [invertedId] } = await inverted.json() as AnalyzerLaneResult;
  const invertedLane = await sessionLane(invertedId) as Lane;
  expect(invertedLane).toMatchObject({ kind: 'audio', parent: imageId });
  expect(Math.abs(invertedLane.samples / invertedLane.sr - 0.51)).toBeLessThanOrEqual(0.01);
  await expect(laneRow(invertedId).getByLabel(`Waveform ${invertedLane.name}`, { exact: true })).toBeVisible();

  await laneRow(source.id).getByLabel(`Spectrogram ${source.name}`).click({ position: { x: 20, y: 20 } });
  await selector.selectOption('f0');
  await page.locator('header strong').click();
  await page.keyboard.press('0');
  await page.screenshot({ path: 'test-results/screens/M5-analyzers.png' });
});
