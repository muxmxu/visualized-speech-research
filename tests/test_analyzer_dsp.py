import numpy as np
import torch

from vsr.analyzers.builtin import energy, vad_energy
from vsr.dsp import active_frames


def test_energy_and_vad_share_frame_centers_and_window_support():
    sr = 8000
    signal = torch.full((1, 320), 0.5)
    level = energy(signal, sr)
    times, active = active_frames(signal, sr)
    np.testing.assert_allclose(level.times.numpy(), [0.01, 0.02, 0.03])
    np.testing.assert_allclose(level.values.numpy(), [-6.0206] * 3)
    np.testing.assert_array_equal(times.numpy(), level.times.numpy())
    np.testing.assert_array_equal(active.numpy(), [True] * 3)
    speech = vad_energy(signal, sr, min_speech_ms=10.0, min_silence_ms=10.0)
    assert speech.items == [(0.0, 0.04, "Speech")]
