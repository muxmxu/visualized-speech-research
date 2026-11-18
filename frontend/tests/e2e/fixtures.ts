import { test as base } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

interface Server { url: string; token: string; audio: string; bytes: Buffer; plugins: string; process: ChildProcess }
export const test = base.extend<{ server: Server }>({
  server: async ({ browserName }, use) => {
    if (browserName !== 'chromium') throw new Error(`Unexpected browser: ${browserName}`);
    const home = await mkdtemp(join(tmpdir(), 'vsr-e2e-'));
    const plugins = join(home, 'plugins');
    await mkdir(plugins);
    const samples = 8000;
    const bytes = Buffer.alloc(44 + samples * 2);
    bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
    bytes.write('data', 36); bytes.writeUInt32LE(samples * 2, 40);
    for (let i = 0; i < samples; i++) bytes.writeInt16LE(Math.round(12000 * Math.sin(2 * Math.PI * 440 * i / 8000)), 44 + i * 2);
    const audio = join(home, 'tone.wav'); await writeFile(audio, bytes);
    const process: ChildProcess = spawn('uv', ['run', '--no-sync', 'python', '-c', "import vsr.device; vsr.device.self_check = lambda device: (_ for _ in ()).throw(RuntimeError('forced self-check failure')); from vsr.cli import main; main()", 'serve', '--port', '0', '--no-browser', '--device', 'cpu'], { cwd: resolve('..'), env: { ...globalThis.process.env, VSR_HOME: home, PYTHONPATH: resolve('../src') }, stdio: ['ignore', 'ignore', 'pipe'] });
    try {
      if (!process.stderr) throw new Error('Server stderr is unavailable');
      let ready = false;
      const lines = createInterface({ input: process.stderr });
      for await (const line of lines) {
        if (line.includes('Application startup complete.')) { ready = true; break; }
      }
      process.stderr.resume();
      if (!ready) throw new Error(`Server exited before startup completed: ${process.exitCode}`);
      const runtime = JSON.parse(await readFile(join(home, 'runtime.json'), 'utf8')) as { port: number; token: string };
      await use({ url: `http://127.0.0.1:${runtime.port}`, token: runtime.token, audio, bytes, plugins, process });
    } finally {
      if (process.exitCode === null && process.signalCode === null) { process.kill('SIGTERM'); await new Promise<void>(resolveExit => process.once('exit', () => resolveExit())); } await rm(home, { recursive: true, force: true });
    }
  },
});
export { expect } from '@playwright/test';
