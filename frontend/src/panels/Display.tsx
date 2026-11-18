import { specLine } from '../state/spectralViews';
import { autoRange } from '../render/spectrogram';
import type { Preset, SpectralView } from '../state/spectralViews';

export function Display({ view, presets, change, applyPreset, applyAll, sr, laneMax }: {
  view: SpectralView | undefined; presets: Record<string, Preset>;
  change: (patch: Partial<SpectralView>) => void; applyPreset: (name: string) => void; applyAll: () => void; sr: number; laneMax: number;
}) {
  if (!view) return <div className="panel">Select a view</div>;
  const range = view.range === 'auto80' ? autoRange(laneMax) : view.range;
  const numeric = (label: string, key: 'win_length' | 'hop' | 'f_lo' | 'f_hi' | 'window_param') =>
    <label><span title={label}>{label === 'Window length' ? 'Win' : label === 'Frequency low' ? 'Low Hz' : label === 'Frequency high' ? 'High Hz' : label === 'Window parameter' ? 'Param' : label}</span><input type="number" aria-label={label} value={view[key]} onChange={event => change({ [key]: Number(event.target.value) })} /></label>;
  return <div className="panel display-panel">
    <section className="display-section" aria-label="Spectrum settings"><h3>Spectrum</h3>
    <label><span title="Preset">Preset</span><select aria-label="Preset" value={view.preset} onChange={event => applyPreset(event.target.value)}>{Object.keys(presets).map(name => <option key={name}>{name}</option>)}</select></label>
    <label><span title="FFT">FFT</span><select aria-label="FFT" value={view.n_fft} onChange={event => { const n_fft = Number(event.target.value); change({ n_fft, win_length: Math.min(view.win_length, n_fft), hop: Math.min(view.hop, n_fft), f_lo: view.yscale === 'log' ? Math.max(view.f_lo, 20, sr / n_fft) : view.f_lo }); }}>{[128,256,512,1024,2048,4096,8192,16384].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    {numeric('Window length', 'win_length')}{numeric('Hop', 'hop')}
    <label><span title="Window">Window</span><select aria-label="Window" value={view.window} onChange={event => change({ window: event.target.value, window_param: event.target.value === 'kaiser' ? 8.6 : event.target.value === 'gaussian' ? 0.125 : 0 })}>{['hann','hamming','blackman','blackmanharris','kaiser','gaussian'].map(value => <option key={value}>{value}</option>)}</select></label>
    {(view.window === 'kaiser' || view.window === 'gaussian') && numeric('Window parameter', 'window_param')}
    </section><section className="display-section" aria-label="Frequency settings"><h3>Frequency</h3>
    <label><span title="Frequency scale">Scale</span><select aria-label="Frequency scale" value={view.yscale} onChange={event => change({ yscale: event.target.value as 'linear' | 'log', f_lo: event.target.value === 'log' ? Math.max(view.f_lo, 20, sr / view.n_fft) : view.f_lo })}><option>linear</option><option>log</option></select></label>
    {numeric('Frequency low', 'f_lo')}{numeric('Frequency high', 'f_hi')}
    </section><section className="display-section" aria-label="Color settings"><h3>Color</h3>
    <label><span title="Palette">Palette</span><select aria-label="Palette" value={view.cmap} onChange={event => change({ cmap: event.target.value })}>{['heat','magma','inferno','viridis','gray','gray_r','RdBu_r'].map(value => <option key={value}>{value}</option>)}</select></label>
    <label><span title="Filter">Filter</span><select aria-label="Filter" value={view.filter} onChange={event => change({ filter: event.target.value as 'LINEAR' | 'NEAREST' })}><option>LINEAR</option><option>NEAREST</option></select></label>
    <label><span title="Colorbar">Colorbar</span><input type="checkbox" checked={view.colorbar} onChange={event => change({ colorbar: event.target.checked })} /></label>
    <label><span title="dB floor">dB floor</span><input type="number" aria-label="dB floor" value={range[0]} onChange={event => change({ range: [Number(event.target.value), range[1]] })} /></label>
    <label><span title="dB ceiling">dB ceiling</span><input type="number" aria-label="dB ceiling" value={range[1]} onChange={event => change({ range: [range[0], Number(event.target.value)] })} /></label>
    <label><span title="Range">Range</span><input type="range" aria-label="dB range" min="-160" max="0" value={range[0]} onChange={event => { const floor = Number(event.target.value); change({ range: [floor, floor + range[1] - range[0]] }); }} /></label>
    </section><div className="display-actions">
    <button onClick={() => change({ range: 'auto80' })}>Auto 80 dB</button>
    <button onClick={applyAll}>Apply to all lanes</button>
    <button onClick={() => { void navigator.clipboard.writeText(specLine(view, presets[view.preset], sr, range)); }}>Copy spec</button>
    </div>
  </div>;
}
