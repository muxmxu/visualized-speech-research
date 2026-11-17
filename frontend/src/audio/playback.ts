import { notifications } from '@mantine/notifications';
import { request } from '../api/client';
import { decodeFrame, type FrameArray } from '../api/frame';
import type { Lane } from '../api/types';

export function chunkBounds(start: number, end: number, sr: number): [number, number][] {
  const result: [number, number][] = [];
  for (let at = start; at < end; at += 20 * sr) result.push([at, Math.min(end, at + 20 * sr)]);
  return result;
}

export class Playback {
  readonly context = new AudioContext();
  readonly master = this.context.createGain();
  readonly analyser = this.context.createAnalyser();
  private gains = new Map<string, GainNode>();
  private sources: AudioBufferSourceNode[] = [];
  private generation = 0;
  private timer = 0;
  private when = 0;
  private startSample = 0;
  private endSample = 0;
  private looping = false;
  private active = false;
  private stopAt = 0;
  private queueLoop: ((loop: boolean, boundary: number) => void) | null = null;
  private laneIds: string[] = [];
  private channels: Record<string, number> = {};
  private tick: ((position: number, playing: boolean) => void) | null = null;
  private loading = false;
  private restartAnchor: number | undefined;
  private sourceTimes = new Map<AudioBufferSourceNode, number>();
  constructor() { this.master.connect(this.analyser); this.analyser.connect(this.context.destination); }
  get playing() { return this.active || this.loading; }
  get position() {
    if (!this.active && !this.loading) return this.endSample / this.context.sampleRate;
    if (this.loading && this.restartAnchor === undefined) return this.startSample / this.context.sampleRate;
    const elapsed = Math.max(0, this.context.currentTime - (this.loading ? this.restartAnchor as number : this.when));
    const duration = (this.endSample - this.startSample) / this.context.sampleRate;
    return this.startSample / this.context.sampleRate + (this.looping || this.stopAt > this.when + duration ? elapsed % duration : Math.min(elapsed, duration));
  }
  setLoop(loop: boolean) {
    this.looping = loop;
    if (!this.active && (!this.loading || this.restartAnchor === undefined)) return;
    const duration = (this.endSample - this.startSample) / this.context.sampleRate;
    this.stopAt = this.when + (Math.floor(Math.max(0, this.context.currentTime - this.when) / duration) + 1) * duration;
    if (this.queueLoop) {
      this.queueLoop(loop, this.stopAt);
    } else {
      for (const source of this.sources) source.loop = loop;
    }
  }
  async update(lanes: Lane[], channels: Record<string, number>) {
    const changed = this.laneIds.some(id => !lanes.some(lane => lane.id === id)) ||
      lanes.some(lane => this.laneIds.includes(lane.id) && lane.channels > 2 && (channels[lane.id] ?? 0) !== (this.channels[lane.id] ?? 0));
    if ((this.active || this.loading) && changed) {
      const remaining = lanes.filter(lane => this.laneIds.includes(lane.id));
      const start = this.startSample / this.context.sampleRate; const end = this.endSample / this.context.sampleRate;
      const anchor = this.active ? this.when : this.restartAnchor;
      const boundary = anchor === undefined ? undefined : this.stopAt;
      const tick = this.tick as (position: number, playing: boolean) => void;
      if (remaining.length === 0) { const position = this.position; this.stop(position); tick(position, false); return; }
      await this.play(remaining, start, end, this.looping, channels, tick, anchor, boundary);
      return;
    }
    const solo = lanes.some(lane => lane.solo);
    for (const lane of lanes) {
      const gain = this.gains.get(lane.id);
      if (gain) gain.gain.value = lane.mute || (solo && !lane.solo) ? 0 : 10 ** (lane.gain_db / 20);
    }
  }
  stop(position = this.position) {
    this.generation++; this.active = false; this.loading = false; window.clearTimeout(this.timer);
    for (const source of this.sources) { source.onended = null; source.stop(); source.disconnect(); }
    this.sources = []; this.sourceTimes.clear(); this.queueLoop = null; this.endSample = Math.round(position * this.context.sampleRate);
    for (const gain of this.gains.values()) gain.disconnect();
    this.gains.clear();
  }
  async play(lanes: Lane[], start: number, end: number, loop: boolean, channels: Record<string, number>, tick: (position: number, playing: boolean) => void, anchor?: number, boundary?: number) {
    this.stop(start);
    const generation = this.generation;
    this.laneIds = lanes.map(lane => lane.id); this.channels = { ...channels }; this.tick = tick; this.loading = true; this.restartAnchor = anchor;
    const sr = this.context.sampleRate;
    this.startSample = Math.round(start * sr); this.endSample = Math.round(end * sr); this.looping = loop;
    if (lanes.length === 0 || this.endSample <= this.startSample) { this.loading = false; return; }
    try {
      await this.context.resume();
      if (generation !== this.generation) return;
      for (const lane of lanes) { const gain = this.context.createGain(); gain.connect(this.master); this.gains.set(lane.id, gain); }
      void this.update(lanes, channels);
      const chunks = chunkBounds(this.startSample, this.endSample, sr);
      const load = async ([a, b]: [number, number], failed?: () => void) => Promise.all(lanes.map(async lane => {
        const buffer = this.context.createBuffer(lane.channels > 2 ? 1 : lane.channels, b - a, sr);
        const origin = Math.round(lane.offset * sr);
        const laneLength = Math.ceil(lane.samples * sr / lane.sr);
        const first = Math.max(a - origin, 0); const last = Math.min(b - origin, laneLength);
        if (last > first) {
          const params = new URLSearchParams({ t0: String(lane.offset + first / sr), t1: String(lane.offset + last / sr), sr: String(sr) });
          if (lane.channels > 2) params.set('channel', String(channels[lane.id] ?? 0));
          let response: Response;
          try {
            response = await request(`/lanes/${lane.id}/pcm?${params}`);
          } catch (error) {
            if (!failed) throw error;
            failed();
            // request() already notified its plain Error for an HTTP failure.
            if (!(error instanceof Error && error.constructor === Error)) notifications.show({ title: 'Request failed', message: String(error), color: 'red' });
            return null;
          }
          const frame = decodeFrame(await response.arrayBuffer()).arrays as FrameArray;
          const data = frame.data as Float32Array; const count = frame.shape[1];
          for (let channel = 0; channel < frame.shape[0]; channel++) buffer.getChannelData(channel).set(data.subarray(channel * count, (channel + 1) * count), origin + first - a);
        }
        return buffer;
      }));
      const duration = (this.endSample - this.startSample) / sr;
      const firstWhen = anchor ?? this.context.currentTime + 0.1;
      let initialIndex: number; let first: (AudioBuffer | null)[];
      for (;;) {
        const elapsed = anchor === undefined ? 0 : Math.max(0, this.context.currentTime - firstWhen);
        if (!this.looping && boundary !== undefined && this.context.currentTime >= this.stopAt) { this.stop(end); tick(end, false); return; }
        initialIndex = Math.floor((elapsed % duration) / 20);
        first = await load(chunks[initialIndex]);
        if (generation !== this.generation) return;
        const now = anchor === undefined ? 0 : Math.max(0, this.context.currentTime - firstWhen);
        if (!this.looping && boundary !== undefined && this.context.currentTime >= this.stopAt) { this.stop(end); tick(end, false); return; }
        if (Math.floor((now % duration) / 20) === initialIndex) break;
      }
      this.when = anchor ?? this.context.currentTime + 0.1;
      const elapsed = Math.max(0, this.context.currentTime - this.when);
      const cycle = Math.floor(elapsed / duration);
      this.stopAt = boundary === undefined ? this.when + duration : this.stopAt; this.active = true; this.loading = false;
      const schedule = (buffers: AudioBuffer[], when: number, repeat: boolean, offset = 0) => buffers.forEach((buffer, index) => {
        const source = this.context.createBufferSource(); source.buffer = buffer; source.loop = repeat;
        source.connect(this.gains.get(lanes[index].id) as GainNode); source.start(when, offset); this.sources.push(source); this.sourceTimes.set(source, when);
        source.onended = () => { source.disconnect(); this.sourceTimes.delete(source); this.sources = this.sources.filter(item => item !== source); };
      });
      const chunkStart = (chunks[initialIndex][0] - this.startSample) / sr;
      const firstStart = this.when + cycle * duration + chunkStart;
      const initialBuffers = first as AudioBuffer[];
      schedule(initialBuffers, Math.max(this.context.currentTime, firstStart), this.looping && chunks.length === 1, Math.max(0, this.context.currentTime - firstStart));
      if (chunks.length === 1) {
        this.queueLoop = (repeat) => {
          const duration = (this.endSample - this.startSample) / sr;
          if (repeat && this.context.currentTime >= this.when + duration && this.sources.every(source => !source.loop)) {
            for (const source of this.sources) { source.onended = null; source.stop(); source.disconnect(); }
            this.sources = []; this.sourceTimes.clear();
            const now = this.context.currentTime;
            schedule(initialBuffers, now, true, (now - this.when) % duration);
          } else {
            for (const source of this.sources) source.loop = repeat;
          }
        };
      } else {
        let index = cycle * chunks.length + initialIndex + 1;
        let scheduled = cycle * duration + (chunks[initialIndex][1] - this.startSample) / sr;
        let limit = this.looping ? Infinity : (cycle + 1) * chunks.length;
        let version = 0;
        const queue = async (current: number) => {
          while (generation === this.generation && current === version && index < limit) {
            const buffers = await load(chunks[index % chunks.length], () => {
              if (generation === this.generation && current === version) {
                const position = this.position; this.stop(position); tick(position, false);
              }
            });
            if (generation !== this.generation || current !== version) return;
            if (buffers.some(buffer => buffer === null)) return;
            schedule(buffers as AudioBuffer[], this.when + scheduled, false);
            const chunk = chunks[index % chunks.length]; scheduled += (chunk[1] - chunk[0]) / sr; index++;
            await new Promise<void>(resolve => { this.timer = window.setTimeout(resolve, Math.max(0, (this.when + scheduled - this.context.currentTime - 20) * 1000)); });
          }
        };
        this.queueLoop = (repeat, boundary) => {
          version++;
          if (repeat) limit = Infinity;
          else {
            const duration = (this.endSample - this.startSample) / sr;
            limit = Math.round((boundary - this.when) / duration) * chunks.length;
            if (index > limit) { index = limit; scheduled = boundary - this.when; }
            for (const source of this.sources.filter(item => (this.sourceTimes.get(item) as number) >= boundary)) {
              source.onended = null; source.stop(); source.disconnect(); this.sourceTimes.delete(source);
              this.sources = this.sources.filter(item => item !== source);
            }
          }
          void queue(version);
        };
        void queue(version);
      }
      const frame = () => {
        if (generation !== this.generation) return;
        const position = this.position;
        if (!this.looping && this.context.currentTime >= this.stopAt) { this.stop(end); tick(end, false); return; }
        tick(position, true); requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    } catch (error) {
      if (generation === this.generation) { const position = this.position; this.stop(position); tick(position, false); }
      throw error;
    }
  }
}
