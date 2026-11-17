import numpy as np

from vsr.dsp.waveform import waveform


def test_waveform_pool_and_raw():
    data = np.array([[0, 1, -1, 0.5, -0.5, 0, 1, -1]], dtype=np.float32)
    pooled, _ = waveform(data, 8, 0, 1, 2)
    np.testing.assert_allclose(pooled, [[[-1, -1], [1, 1], [0.75, 0.75]]])
    raw, header = waveform(data, 8, 0.125, 0.375, 4)
    np.testing.assert_array_equal(raw, [[1, -1]])
    assert header["first_sample"] == 1


def test_waveform_outside_lane():
    data = np.ones((1, 8), dtype=np.float32)
    result, meta = waveform(data, 8, -1, 1, 4)
    assert result.shape == (1, 3, 2)
    assert meta["t0"] == 0 and meta["t1"] == 1
