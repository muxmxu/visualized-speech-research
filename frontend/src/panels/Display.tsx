import { displayUnit, featureAxisLabel, featureSpecLine, specLine } from '../state/spectralViews';
import type { Preset, ViewConfig, ViewPatch } from '../state/spectralViews';
import type { MelSettings, SessionLane } from '../api/types';

export function Display({ view, presets, change, applyPreset, applyAll, lane, range, naturalRange }: {
  view: ViewConfig | undefined; presets: Record<string, Preset>;
  change: (patch: ViewPatch) => void; applyPreset: (name: string) => void; applyAll: () => void;
  lane: SessionLane | undefined; range: [number, number]; naturalRange: [number, number];
}) {
  if (!view || !lane) return <div className="panel">Select a view</div>;
  const sr = lane.sr;
  const unit = displayUnit(lane);
  const rangeLabel = unit === 'value' ? 'value' : 'dB';
  const number = (label: string, short: string, value: number, update: (value: number) => void, step: number | 'any' = 'any') =>
    <label><span title={label}>{short}</span><input type="number" step={step} aria-label={label} value={value} onChange={event => { if (event.target.value !== '') update(Number(event.target.value)); }} /></label>;
  const rangeWidth = range[1] - range[0];
  const sliderMin = unit === 'value' ? naturalRange[0] : -160;
  const sliderMax = unit === 'value' ? naturalRange[1] : 0;
  return <div className="panel display-panel">
    {view.kind === 'audio' && <>
      <section className="display-section" aria-label="Spectrum settings"><h3>Spectrum</h3>
        <label><span title="Preset">Preset</span><select aria-label="Preset" value={view.preset} onChange={event => applyPreset(event.target.value)}>{Object.keys(presets).map(name => <option key={name}>{name}</option>)}</select></label>
        <label><span title="Spectrogram mode">Mode</span><select aria-label="Spectrogram mode" value={view.transform} onChange={event => {
          const transform = event.target.value as 'stft' | 'mel';
          if (transform === 'stft' && view.yscale === 'log') {
            const f_lo = Math.max(view.f_lo, 20, sr / view.n_fft);
            const f_hi = view.f_hi > f_lo ? view.f_hi : sr / 2;
            change({ transform, f_lo, f_hi });
          } else change({ transform });
        }}><option value="stft">STFT</option><option value="mel">Mel</option></select></label>
        <label><span title="FFT">FFT</span><select aria-label="FFT" value={view.n_fft} onChange={event => { const n_fft = Number(event.target.value); change({ n_fft, win_length: Math.min(view.win_length, n_fft), hop: Math.min(view.hop, n_fft), f_lo: view.yscale === 'log' && view.transform === 'stft' ? Math.max(view.f_lo, 20, sr / n_fft) : view.f_lo }); }}>{[128,256,512,1024,2048,4096,8192,16384].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        {number('Window length', 'Win', view.win_length, win_length => change({ win_length }), 1)}
        {number('Hop', 'Hop', view.hop, hop => change({ hop }), 1)}
        <label><span title="Window">Window</span><select aria-label="Window" value={view.window} onChange={event => change({ window: event.target.value, window_param: event.target.value === 'kaiser' ? 8.6 : event.target.value === 'gaussian' ? 0.125 : 0 })}>{['hann','hamming','blackman','blackmanharris','kaiser','gaussian'].map(value => <option key={value}>{value}</option>)}</select></label>
        {(view.window === 'kaiser' || view.window === 'gaussian') && number('Window parameter', 'Param', view.window_param, window_param => change({ window_param }))}
      </section>
      <section className="display-section" aria-label="Frequency settings"><h3>Frequency</h3>
        {view.transform === 'stft' ? <label><span title="Frequency scale">Scale</span><select aria-label="Frequency scale" value={view.yscale} onChange={event => change({ yscale: event.target.value as 'linear' | 'log', f_lo: event.target.value === 'log' ? Math.max(view.f_lo, 20, sr / view.n_fft) : view.f_lo })}><option>linear</option><option>log</option></select></label> : <>
          {([['Mel channels', 'Channels', 'n_mels'], ['Mel minimum (Hz)', 'Mel min', 'fmin'], ['Mel maximum (Hz)', 'Mel max', 'fmax']] as const).map(([full, short, key]) =>
            <div key={key}>{number(full, short, view.mel[key], value => change({ mel: { ...view.mel, [key]: value } satisfies MelSettings }), key === 'n_mels' ? 1 : 'any')}</div>)}
          <label>HTK <input type="checkbox" checked={view.mel.htk} onChange={event => change({ mel: { ...view.mel, htk: event.target.checked } })} /></label>
        </>}
        {number('Frequency low', 'Low Hz', view.f_lo, f_lo => change({ f_lo }))}
        {number('Frequency high', 'High Hz', view.f_hi, f_hi => change({ f_hi }))}
      </section>
    </>}
    {lane.kind === 'feature' && <section className="display-section" aria-label="Feature axis settings"><h3>Feature axis</h3>
      <p>{featureAxisLabel(lane.freq_axis)}</p>
      {number('First row', 'First row', view.f_lo, value => change({ f_lo: Math.max(0, Math.min(view.f_hi, Math.round(value))) }), 1)}
      {number('Last row', 'Last row', view.f_hi, value => change({ f_hi: Math.max(view.f_lo, Math.min(lane.rows - 1, Math.round(value))) }), 1)}
    </section>}
    <section className="display-section" aria-label="Color settings"><h3>Color</h3>
      <label><span title="Palette">Palette</span><select aria-label="Palette" value={view.cmap} onChange={event => change({ cmap: event.target.value })}>{['heat','magma','inferno','viridis','gray','gray_r','RdBu_r'].map(value => <option key={value}>{value}</option>)}</select></label>
      <label><span title="Filter">Filter</span><select aria-label="Filter" value={view.filter} onChange={event => change({ filter: event.target.value as 'LINEAR' | 'NEAREST' })}><option>LINEAR</option><option>NEAREST</option></select></label>
      <label><span title="Colorbar">Colorbar</span><input type="checkbox" checked={view.colorbar} onChange={event => change({ colorbar: event.target.checked })} /></label>
      {number(`${rangeLabel} floor`, `${rangeLabel} floor`, range[0], floor => change({ range: [floor, range[1]] }))}
      {number(`${rangeLabel} ceiling`, `${rangeLabel} ceiling`, range[1], ceiling => change({ range: [range[0], ceiling] }))}
      <label><span title={`${rangeLabel} range`}>Range</span><input type="range" aria-label={`${rangeLabel} range`} min={sliderMin} max={sliderMax} step={unit === 'value' ? 'any' : 1} value={range[0]} onChange={event => { const floor = Number(event.target.value); change({ range: [floor, floor + rangeWidth] }); }} /></label>
    </section>
    <div className="display-actions">
      <button onClick={() => change({ range: 'auto80' })}>{unit === 'value' ? 'Auto value range' : 'Auto 80 dB'}</button>
      <button onClick={applyAll}>Apply to all lanes</button>
      <button onClick={() => {
        if (view.kind === 'audio') void navigator.clipboard.writeText(specLine(view, presets[view.preset], sr, range));
        else if (lane.kind === 'feature') void navigator.clipboard.writeText(featureSpecLine(view, lane, range));
      }}>Copy spec</button>
    </div>
  </div>;
}
