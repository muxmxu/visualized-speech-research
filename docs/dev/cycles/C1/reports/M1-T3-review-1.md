# M1-T3 semantic review 1

## Verdict

FAIL. Return the frozen task to the Worker for correction before the D38 Git handoff.

## Issues and required action

- **Chunk-dependent mask weights.** At `src/vsr/dsp/edit.py:11–19`, the lower edge cell and fraction are combined before the float32 subtraction of the frame index. A later edge in a longer chunk therefore loses more precision than the same edge in a shorter chunk. The 3-second Hann fixture below produces a difference of `1.9669533e-05` for shared samples with an identical D43 rectangle. The long request differs from the independent full-lane reference by `1.9609928e-05`, exceeding the §19 `1e-6` tolerance. Keep the grid-cell difference exact before adding the edge fraction, and verify the same mask across both requests and against the whole-lane reference.
- **Accepted finite bounds can raise a server error.** At `src/vsr/dsp/edit.py:14–17`, conversion to grid units can overflow before testing if the edge is within the two-step transition. The Hann fixture with finite ordered selection bounds `[-1e308, 1e308]` returns HTTP 500 with `OverflowError` and detail `cannot convert float infinity to integer`. The rectangle covers every frame and frequency bin in this fixture. Evaluate distant finite edges without overflowing and preserve unit membership on this interval.
- **Mask precision at a NOLA-valid physical edge.** At `src/vsr/dsp/edit.py:19–26`, the float32 cosine weights and their product differ from the task plan's float64-coordinate mask cast to float32. A narrow Gaussian accepted by both the HTTP overlap check and the whole-lane Torch inverse amplifies the coefficient error at the lane end. The fixture below returns HTTP 200 and differs from the reference by `2.2888184e-05`; the reference peak is `123.84543`. The full request and a short request covering its final four samples agree exactly. Include an accepted Gaussian edge in the numerical verification of the coefficient correction.

## Reproduction on the frozen task tree

Run from the root of the `task/M1-T3` worktree. The script creates only temporary FLOAT WAV fixtures and a temporary `VSR_HOME`.

```bash
PYTHONDONTWRITEBYTECODE=1 uv run --no-sync python - <<'PY'
import os
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from fastapi.testclient import TestClient
from scipy.signal import get_window

from vsr.frame import decode_frame
from vsr.server.app import create_app


def check(x, mask, intervals):
    sr = mask["sr"]
    size = mask["n_fft"]
    length = mask["win_length"]
    hop = length // 4
    kind = mask["window"]
    if kind == "gaussian":
        kind = (kind, mask["window_param"] * length)
    w = torch.from_numpy(get_window(kind, length, fftbins=True).astype(np.float32))
    z = torch.stft(torch.from_numpy(x), size, hop_length=hop, win_length=length,
                   window=w, center=True, pad_mode="constant", return_complex=True)

    def axis(coords, lo, hi, step):
        d = np.maximum(np.maximum(lo - coords, coords - hi), 0)
        return np.where(d < 2 * step, (1 + np.cos(np.pi * d / (2 * step))) / 2, 0)

    t = axis(np.arange(z.shape[-1]) * (hop / sr),
             mask["selection_t0"], mask["selection_t1"], hop / sr)
    f = axis(np.arange(z.shape[-2]) * (sr / size),
             mask["f_lo"], mask["f_hi"], sr / size)
    weights = torch.from_numpy((f[:, None] * t[None, :]).astype(np.float32))
    y = torch.istft(z * weights, size, hop_length=hop, win_length=length,
                    window=w, center=True, length=x.shape[-1]).numpy()
    with tempfile.TemporaryDirectory() as home:
        os.environ["VSR_HOME"] = home
        wave = Path(home) / "fixture.wav"
        sf.write(wave, x.T, sr, subtype="FLOAT")
        auth = {"Authorization": "Bearer fixture"}
        with TestClient(create_app("fixture", "cpu", [str(wave)]),
                        raise_server_exceptions=False) as client:
            lane = client.get("/api/session", headers=auth).json()["lanes"][0]["id"]
            url = f"/api/lanes/{lane}/pcm"
            chunks = []
            for a, b in intervals:
                p = mask | {"t0": a / sr, "t1": b / sr}
                response = client.get(url, params=p, headers=auth)
                assert response.status_code == 200, response.text
                data, metadata = decode_frame(response.content)
                assert metadata["first_sample"] == a
                chunks.append(data)
                print(p["window"], response.status_code, np.max(np.abs(data - y[:, a:b])))
            a, b = intervals[-1]
            print("shared samples", np.max(np.abs(chunks[0][:, a:b] - chunks[-1])))
            print("reference peak", np.max(np.abs(y)))
            if mask["window"] == "hann":
                p = mask | {"t0": 0, "t1": 1, "selection_t0": -1e308, "selection_t1": 1e308}
                response = client.get(url, params=p, headers=auth)
                print("wide finite rectangle", response.status_code,
                      {k: response.json()[k] for k in ("error", "detail")}
                      if response.status_code != 200 else {})


check(np.full((1, 24000), 0.75, dtype=np.float32),
      dict(sr=8000, selection_t0=2.00016665, selection_t1=2.5, f_lo=0, f_hi=4000,
           n_fft=16, win_length=16, window="hann", window_param=0),
      [(0, 24000), (15992, 16016)])
check(np.random.default_rng(42).normal(0, 0.15, (2, 29)).astype(np.float32),
      dict(sr=8000, selection_t0=0.000021, selection_t1=28.3/8000, f_lo=207.123, f_hi=2340.321,
           n_fft=32, win_length=21, window="gaussian", window_param=0.03625),
      [(0, 29), (25, 29)])
PY
```

Observed output, excluding the Starlette TestClient deprecation warning.

```text
hann 200 1.9609928e-05
hann 200 1.1920929e-07
shared samples 1.9669533e-05
reference peak 0.75000006
wide finite rectangle 500 {'error': 'OverflowError', 'detail': 'cannot convert float infinity to integer'}
gaussian 200 2.2888184e-05
gaussian 200 2.2888184e-05
shared samples 0.0
reference peak 123.84543
```

## Evidence and notes

- The tracked binary diff SHA-256 is `f6bb714a3012e143540df8500e1c938b2e67d49ee737a05dd758a56e4b0ab4d2`. The four changed paths match the mechanical audit. HEAD and the task cut are `70d7f5c45e18b78777883bd1e6a2207704f6265f`.
- `src/vsr/dsp/edit.py` SHA-256 is `47a52cf1d99ec942e8f35f88f0e92a68c3568e720953f33d706e7fdff5b28baa`.
- `src/vsr/server/app.py` SHA-256 is `0800e90e9e45add68869387ca426639dbcb22ecef54691794d12f58b879ec0cb`.
- `tests/test_pcm.py` SHA-256 is `e95f357087cbe7a24a0107cc6613e4ca7020e665cfb6aa04bd680a5124b66801`.
- `tests/test_spectral_mask.py` SHA-256 is `ecb03bd57bd20d92d50a7bd4ca51506ca8297eb790435e7b966324f94a6ca63f`.
- The frame bounds retain every inverse contribution on the requested interval and preserve odd-FFT zero padding at physical lane endpoints. The centered inverse length includes the explicit leading crop and normalizes by squared-window overlap. The route reconstructs the FIR source margin on the same lane frame grid before the phase-aligned SciPy resample. It snapshots channel data, rate, length and offset under the session lock and releases the lock before the transform, which uses the selected compute device.
- The independent CPU matrix generated two-channel FLOAT WAVs at 8 kHz with lengths 1–251, even and odd FFTs with shorter windows, all six supported window families, a nonzero offset, and target rates 500, 8000 and 11025 Hz. Of 168 masked requests, 160 agreed with the full-lane reference within `1e-6`, six invalid overlaps returned 422 with all three error fields, and two NOLA-valid narrow Gaussian cases exceeded `1e-6` as described above. All 48 ordinary PCM comparisons were bitwise equal to the full-lane resample for the requested channel set. Missing bearer and missing lane returned 401 and 404 respectively with the expected error keys.
- The audited long-lane fixture covers full selection versus short selection, the 44.1-to-48 kHz seam, and both physical edges. The mask test derives its expected values independently. The 48 kHz preset tuples used by the tone tests matched the authenticated `/api/presets` response for `analysis`, `wideband` and `narrowband`.
- **Allowed T1 REVIEW, `tests/test_spectral_mask.py:11`.** The CUDA parameter skips only if `torch.cuda.is_available()` is false, with reason `CUDA unavailable`, as specified by DESIGN §20.
- **Allowed T1 REVIEW, `tests/test_spectral_mask.py:15`.** The MPS parameter skips only if `torch.backends.mps.is_available()` is false, with reason `MPS unavailable`, as specified by DESIGN §20.
- CUDA and MPS execution was unavailable. Browser scheduling is assigned to T6. The mechanical suite results are recorded separately. [Mechanical audit](M1-T3-audit-1.md)
