import { notifications } from '@mantine/notifications';
import { createElement } from 'react';
import { decodeFrame } from './frame';
import type { FrameArray } from './frame';
import type { AnalyzerCatalog, AnalyzerCurveData, AnalyzerLaneResult, AnalyzerRequest, AnalyzerResult, AnalyzerScalarResult, AnalyzerSpectrum, EventInterval } from './types';
import type { AudioDevices, Lane, LaneEdit, MixdownRequest, RecordArm, RecordCalibrate, RecordStart, RecordState, SaveSubtype } from './types';

const params = new URLSearchParams(location.search);
const bootstrap = params.get('token');
if (bootstrap !== null) {
  sessionStorage.setItem('token', bootstrap);
  params.delete('token');
  history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : '') + location.hash);
}
export const token = sessionStorage.getItem('token') ?? '';
export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export class NetworkError extends Error {}
export async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`/api${path}`, { ...init, headers }).catch((error: unknown) => {
    if (error instanceof TypeError) throw new NetworkError(error.message);
    throw error;
  });
  if (!response.ok) {
    const error = await response.json() as { error: string; detail: string; traceback: string | null };
    const message = error.traceback ? createElement('div', null, error.detail, createElement('details',
      { className: 'api-traceback' }, createElement('summary', null, 'Traceback'), createElement('pre', null, error.traceback))) : error.detail;
    notifications.show({ title: error.error, message, color: 'red', autoClose: false });
    throw new ApiError(error.detail, response.status);
  }
  return response;
}
export async function json<T>(path: string, init: RequestInit = {}): Promise<T> {
  return await (await request(path, init)).json() as T;
}
export function body(value: unknown): RequestInit { return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }; }

export function editLane(id: string, edit: LaneEdit) {
  return request(`/lanes/${id}/edit`, body(edit));
}
export function stepHistory(id: string, direction: 'undo' | 'redo') {
  return request(`/lanes/${id}/${direction}`, { method: 'POST' });
}
export function saveLane(id: string, subtype: SaveSubtype, path?: string) {
  return request(`/lanes/${id}/save`, body({ path, subtype }));
}

export function audioDevices() {
  return json<AudioDevices>('/audio/devices');
}
export function armRecording(settings: RecordArm) {
  return json<RecordState>('/record/arm', body(settings));
}
export function startRecording(settings: RecordStart) {
  return json<RecordState>('/record/start', body(settings));
}
export function stopRecording() {
  return json<{ lanes: Lane[] }>('/record/stop', { method: 'POST' });
}
export function calibrateRecording(settings: RecordCalibrate) {
  return json<{ latency_ms: number }>('/record/calibrate', body(settings));
}
export function mixdown(settings: MixdownRequest) {
  return json<{ path: string; clipping: boolean }>('/mixdown', body(settings));
}

export function analyzers() {
  return json<AnalyzerCatalog>('/analyzers');
}
export async function analyze(id: string, input: AnalyzerRequest): Promise<AnalyzerResult> {
  const response = await request(`/analyzers/${encodeURIComponent(id)}/run`, body(input));
  if (response.headers.get('Content-Type')?.includes('application/json')) {
    return await response.json() as AnalyzerLaneResult | AnalyzerScalarResult;
  }
  const { header, arrays } = decodeFrame(await response.arrayBuffer());
  const data = arrays as Record<string, FrameArray>;
  return { ...(header as unknown as Pick<AnalyzerSpectrum, 'kind' | 'lanes' | 'result'>),
    frequencies: data.freqs.data as Float32Array, values: data.values.data as Float32Array };
}
export async function analyzerCurveData(id: string, signal: AbortSignal): Promise<AnalyzerCurveData> {
  const response = await request(`/lanes/${id}/data`, { signal });
  const { arrays } = decodeFrame(await response.arrayBuffer());
  const data = arrays as Record<string, FrameArray>;
  return { times: data.times.data as Float32Array, values: data.values.data as Float32Array };
}
export function analyzerEvents(id: string, signal: AbortSignal) {
  return json<{ items: EventInterval[] }>(`/lanes/${id}/data`, { signal });
}
