import numpy as np
import pytest

from vsr.dsp import rir_metrics
from vsr.dsp.rir import energy_metrics


@pytest.mark.parametrize("sr", [16000, 48000])
@pytest.mark.parametrize("t60", [0.3, 0.8, 1.5])
def test_noisy_broadband_t30_matches_known_decay(sr, t60):
    rng = np.random.default_rng(42)
    times = np.arange(round((2 * t60 + 1) * sr)) / sr
    reverberation, noise = rng.standard_normal((2, len(times)))
    h = reverberation * np.exp(-6.91 * times / t60) + 10 ** (-50 / 20) * noise
    broadband = rir_metrics(h.astype(np.float32), sr, bands=[])["bands"]["broadband"]
    assert broadband["T30"] is not None, broadband["reasons"]
    assert abs(broadband["T30"] / t60 - 1) < 0.05, broadband
    assert broadband["noise_floor_db"] is not None
    assert broadband["crosspoint_s"] < len(times) / sr


def test_exponential_c50_and_d50_match_finite_geometric_energy_sums():
    sr, t60 = 48000, 0.8
    count = sr // 4
    split = round(0.05 * sr)
    rate = np.exp(-6.91 / (sr * t60))
    h = rate ** np.arange(count)
    result = rir_metrics(h.astype(np.float32), sr, bands=[], use_lundeby=False)
    broadband = result["bands"]["broadband"]
    energy_ratio = rate**2
    early = (1 - energy_ratio**split) / (1 - energy_ratio)
    late = energy_ratio**split * (1 - energy_ratio ** (count - split)) / (1 - energy_ratio)
    assert abs(broadband["C50"] - 10 * np.log10(early / late)) < 0.2
    assert abs(broadband["D50"] - early / (early + late)) < 0.01


def test_drr_uses_only_measured_energy_through_cutoff():
    h = np.zeros(240)
    h[[10, 100, 150, 220]] = [8, 3, 4, 6]
    metrics, _ = energy_metrics(h, 1000, onset=10, peak=10, cutoff=200, sos=None, tail=39)

    assert metrics["DRR"] == pytest.approx(10 * np.log10(64 / 25))
    assert metrics["C50"] == pytest.approx(0)
    assert metrics["C80"] == pytest.approx(0)
