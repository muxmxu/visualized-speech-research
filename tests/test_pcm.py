import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient
from scipy.signal import resample_poly

from vsr.frame import decode_frame
from vsr.server.app import create_app


def test_pcm_reference_and_adjacent_chunks(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    rng = np.random.default_rng(42)
    source = rng.normal(0, 0.1, 48_000 * 21).astype(np.float32)
    path = tmp_path / "signal.wav"
    sf.write(path, source, 48000, subtype="FLOAT")
    reference = resample_poly(source, 44100, 48000)
    with TestClient(create_app("secret", "cpu")) as client:
        headers = {"Authorization": "Bearer secret"}
        lane = client.post("/api/open", json={"paths": [str(path)]}, headers=headers).json()[
            "lanes"
        ][0]["id"]
        for t0, t1 in [(0, 21), (19, 20), (20, 21)]:
            response = client.get(
                f"/api/lanes/{lane}/pcm", params={"t0": t0, "t1": t1, "sr": 44100}, headers=headers
            )
            actual, _ = decode_frame(response.content)
            np.testing.assert_array_equal(actual[0], reference[t0 * 44100 : t1 * 44100])


def test_pcm_same_rate(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    source = np.array([0, 1, 0, -1, 0, 1, 0, -1], dtype=np.float32)
    path = tmp_path / "simple.wav"
    sf.write(path, source, 4, subtype="FLOAT")
    with TestClient(create_app("secret", "cpu")) as client:
        headers = {"Authorization": "Bearer secret"}
        lane = client.post("/api/open", json={"paths": [str(path)]}, headers=headers).json()[
            "lanes"
        ][0]["id"]
        response = client.get(
            f"/api/lanes/{lane}/pcm", params={"t0": 0.5, "t1": 1.5, "sr": 4}, headers=headers
        )
        actual, _ = decode_frame(response.content)
        np.testing.assert_array_equal(actual, [[0, -1, 0, 1]])


def test_masked_pcm_suppresses_outside_frequency(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    sr = 8000
    x = np.sin(2 * np.pi * 500 * np.arange(sr) / sr).astype(np.float32)
    path = tmp_path / "mask.wav"
    sf.write(path, x, sr, subtype="FLOAT")
    with TestClient(create_app("secret", "cpu")) as client:
        headers = {"Authorization": "Bearer secret"}
        lane = client.post("/api/open", json={"paths": [str(path)]}, headers=headers).json()[
            "lanes"
        ][0]["id"]
        params = dict(
            t0=0,
            t1=1,
            sr=sr,
            selection_t0=0,
            selection_t1=1,
            f_lo=2000,
            f_hi=3000,
            n_fft=256,
            win_length=256,
            window="hann",
            window_param=0,
        )
        response = client.get(f"/api/lanes/{lane}/pcm", params=params, headers=headers)
        actual, _ = decode_frame(response.content)
        assert np.sqrt(np.mean(actual[:, 1000:-1000] ** 2)) < 0.01


def _open_client(tmp_path, monkeypatch, x, sr, offset=0):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    path = tmp_path / "fixture.wav"
    sf.write(path, x.T, sr, subtype="FLOAT")
    client = TestClient(create_app("secret", "cpu"))
    client.__enter__()
    headers = {"Authorization": "Bearer secret"}
    lane = client.post("/api/open", json={"paths": [str(path)]}, headers=headers).json()["lanes"][
        0
    ]["id"]
    client.patch(f"/api/lanes/{lane}", json={"offset": offset}, headers=headers)
    return client, lane, headers


def test_mask_boundaries_and_channels(tmp_path, monkeypatch):
    x = np.random.default_rng(42).normal(0, 0.1, (2, 1000)).astype(np.float32)
    client, lane, headers = _open_client(tmp_path, monkeypatch, x, 1000)
    params = dict(
        t0=0,
        t1=1,
        sr=1000,
        selection_t0=0.1,
        selection_t1=0.9,
        f_lo=100,
        f_hi=300,
        n_fft=64,
        win_length=32,
        window="hann",
        window_param=0,
    )
    url = f"/api/lanes/{lane}/pcm"
    all_response = client.get(url, params=params, headers=headers)
    all_data, meta = decode_frame(all_response.content)
    assert meta["first_sample"] == 0 and meta["sr"] == 1000
    assert all_response.headers["cache-control"] == "no-store"
    selected, _ = decode_frame(
        client.get(url, params=params | {"channel": 1}, headers=headers).content
    )
    np.testing.assert_array_equal(selected[0], all_data[1])
    empty, meta = decode_frame(
        client.get(url, params=params | {"t0": 2, "t1": 3}, headers=headers).content
    )
    assert empty.shape == (2, 0) and meta["first_sample"] == 1000
    for key in (
        "selection_t0",
        "selection_t1",
        "f_lo",
        "f_hi",
        "n_fft",
        "win_length",
        "window",
        "window_param",
    ):
        incomplete = params.copy()
        del incomplete[key]
        response = client.get(url, params=incomplete, headers=headers)
        assert response.status_code == 422 and set(response.json()) == {
            "error",
            "detail",
            "traceback",
        }
    bad = [
        dict(t0=1),
        dict(t0="nan"),
        dict(t1="inf"),
        dict(sr=0),
        dict(channel=-1),
        dict(channel=2),
        dict(selection_t0=0.9),
        dict(selection_t1="nan"),
        dict(f_lo=300),
        dict(f_hi=99),
        dict(f_lo="inf"),
        dict(n_fft=3),
        dict(win_length=3),
        dict(n_fft=16),
        dict(window="boxcar"),
        dict(window="unknown"),
        dict(window_param=1),
        dict(window="gaussian", window_param=0),
        dict(window="gaussian", window_param=-1),
        dict(window="gaussian", window_param=1e-10, win_length=16, n_fft=32),
    ]
    for change in bad:
        response = client.get(url, params=params | change, headers=headers)
        assert response.status_code == 422, change
        assert set(response.json()) == {"error", "detail", "traceback"}
    for window, param in [("gaussian", 0.125), ("kaiser", 8.6)]:
        assert (
            client.get(
                url, params=params | {"window": window, "window_param": param}, headers=headers
            ).status_code
            == 200
        )
    assert client.get(url, params=params).status_code == 401
    assert (
        client.get(url, params=params, headers={"Authorization": "Bearer wrong"}).status_code == 401
    )
    client.__exit__(None, None, None)


def test_masked_preset_tones(tmp_path, monkeypatch):
    sr = 48000
    i = np.arange(2 * sr)
    x = (0.3 * np.sin(2 * np.pi * 3000 * i / sr) + 0.2 * np.sin(2 * np.pi * 500 * i / sr)).astype(
        np.float32
    )[None, :]
    client, lane, headers = _open_client(tmp_path, monkeypatch, x, sr)
    for name, n_fft, win_length in [
        ("analysis", 2048, 2048),
        ("wideband", 1024, 240),
        ("narrowband", 4096, 1536),
    ]:
        params = dict(
            t0=0,
            t1=2,
            sr=sr,
            selection_t0=0.25,
            selection_t1=1.75,
            f_lo=2000,
            f_hi=4000,
            n_fft=n_fft,
            win_length=win_length,
            window="hann",
            window_param=0,
        )
        data, _ = decode_frame(
            client.get(f"/api/lanes/{lane}/pcm", params=params, headers=headers).content
        )
        indices = i[24000:72000]
        levels = [
            20
            * np.log10(
                abs(2 * np.mean(data[0, 24000:72000] * np.exp(-2j * np.pi * f * indices / sr)))
                / amplitude
            )
            for f, amplitude in [(500, 0.2), (3000, 0.3)]
        ]
        print(name, levels)
        assert levels[0] <= -40 and abs(levels[1]) < 1
    client.__exit__(None, None, None)


def test_long_masked_chunks_against_full_lane(tmp_path, monkeypatch):
    from test_spectral_mask import oracle

    source_sr, target_sr, offset = 44100, 48000, 0.375
    indices = np.arange(44 * source_sr)
    x = (
        0.3 * np.sin(2 * np.pi * 3000 * indices / source_sr)
        + 0.2 * np.sin(2 * np.pi * 500 * indices / source_sr)
    ).astype(np.float32)[None, :]
    client, lane, headers = _open_client(tmp_path, monkeypatch, x, source_sr, offset)
    url = f"/api/lanes/{lane}/pcm"

    def bound(i):
        return offset + i / target_sr

    def fetch(a, b, mask=None):
        params = dict(t0=bound(a), t1=bound(b), sr=target_sr)
        if mask is not None:
            lo, hi = mask
            params.update(
                selection_t0=offset + lo,
                selection_t1=offset + hi,
                f_lo=2000,
                f_hi=4000,
                n_fft=1024,
                win_length=221,
                window="hann",
                window_param=0,
            )
        response = client.get(url, params=params, headers=headers)
        assert response.status_code == 200, response.text
        actual, meta = decode_frame(response.content)
        assert meta["sr"] == target_sr and meta["first_sample"] == max(0, a)
        assert actual.shape == (1, min(2112000, b) - max(0, a))
        assert np.isfinite(actual).all()
        return actual

    a, seam, b = 100003, 1060003, 2020003
    ordinary = resample_poly(x, target_sr, source_sr, axis=1)
    for lo, hi in [(a, seam), (seam, b)]:
        actual = fetch(lo, hi)
        error = np.max(np.abs(actual - ordinary[:, lo:hi]))
        print("ordinary", lo, error)
        assert error < 1e-6
    full_mask = (a / target_sr, b / target_sr)
    reference = oracle(x, source_sr, 1024, 221, "hann", 0, *full_mask, 2000, 4000, target_sr)
    chunks = [fetch(a, seam, full_mask), fetch(seam, b, full_mask)]
    joined = np.concatenate(chunks, axis=1)
    for label, actual, expected in [
        ("first", chunks[0], reference[:, a:seam]),
        ("second", chunks[1], reference[:, seam:b]),
        ("joined", joined, reference[:, a:b]),
        (
            "seam",
            joined[:, seam - a - 2048 : seam - a + 2048],
            reference[:, seam - 2048 : seam + 2048],
        ),
    ]:
        error = np.max(np.abs(actual - expected))
        print(label, error)
        assert error < 1e-6
    short_mask = (a / target_sr, seam / target_sr)
    short_reference = oracle(x, source_sr, 1024, 221, "hann", 0, *short_mask, 2000, 4000, target_sr)
    short = fetch(a, seam, short_mask)
    error = np.max(np.abs(short - short_reference[:, a:seam]))
    difference = np.max(np.abs(short[:, -2048:] - chunks[0][:, -2048:]))
    print("short", error, "edge difference", difference)
    assert error < 1e-6 and difference > 1e-6
    for lo, hi, mask in [(-17, 641, (0, 0.05)), (2111359, 2112017, (43.95, 44))]:
        ref = oracle(x, source_sr, 1024, 221, "hann", 0, *mask, 2000, 4000, target_sr)
        actual = fetch(lo, hi, mask)
        error = np.max(np.abs(actual - ref[:, max(0, lo) : min(2112000, hi)]))
        print("edge", lo, error)
        assert error < 1e-6
    client.__exit__(None, None, None)


def test_short_odd_fft_matches_whole_lane(tmp_path, monkeypatch):
    from test_spectral_mask import oracle

    x = np.random.default_rng(42).normal(0, 0.1, (1, 100)).astype(np.float32)
    client, lane, headers = _open_client(tmp_path, monkeypatch, x, 100)
    for n_fft in (32, 33):
        params = dict(
            t0=0.11,
            t1=0.93,
            sr=100,
            selection_t0=0.2,
            selection_t1=0.8,
            f_lo=10,
            f_hi=30,
            n_fft=n_fft,
            win_length=21,
            window="hann",
            window_param=0,
        )
        response = client.get(f"/api/lanes/{lane}/pcm", params=params, headers=headers)
        actual, meta = decode_frame(response.content)
        expected = oracle(x, 100, n_fft, 21, "hann", 0, 0.2, 0.8, 10, 30)
        assert meta["first_sample"] == 11
        assert np.max(np.abs(actual - expected[:, 11:93])) < 1e-6
    client.__exit__(None, None, None)


def test_gaussian_rejects_missing_overlap_at_physical_end(tmp_path, monkeypatch):
    x = np.ones((1, 100), dtype=np.float32)
    client, lane, headers = _open_client(tmp_path, monkeypatch, x, 100)
    params = dict(
        t0=0.95,
        t1=1,
        sr=100,
        selection_t0=0,
        selection_t1=1,
        f_lo=0,
        f_hi=40,
        n_fft=33,
        win_length=16,
        window="gaussian",
        window_param=0.03625,
    )
    response = client.get(f"/api/lanes/{lane}/pcm", params=params, headers=headers)
    assert response.status_code == 422
    assert set(response.json()) == {"error", "detail", "traceback"}
    client.__exit__(None, None, None)


def test_fractional_mask_chunk_independence(tmp_path, monkeypatch):
    from test_spectral_mask import oracle

    sr = 8000
    x = np.full((1, 24000), 0.75, dtype=np.float32)
    client, lane, headers = _open_client(tmp_path, monkeypatch, x, sr)
    params = dict(
        sr=sr,
        selection_t0=2.00016665,
        selection_t1=2.5,
        f_lo=0,
        f_hi=4000,
        n_fft=16,
        win_length=16,
        window="hann",
        window_param=0,
    )
    expected = oracle(x, sr, 16, 16, "hann", 0, 2.00016665, 2.5, 0, 4000)
    outputs = []
    for a, b in [(0, 24000), (15992, 16016)]:
        response = client.get(
            f"/api/lanes/{lane}/pcm", params=params | {"t0": a / sr, "t1": b / sr}, headers=headers
        )
        assert response.status_code == 200
        actual, _ = decode_frame(response.content)
        error = np.max(np.abs(actual - expected[:, a:b]))
        print("fractional", a, error)
        assert error < 1e-6
        outputs.append(actual)
    difference = np.max(np.abs(outputs[0][:, 15992:16016] - outputs[1]))
    print("fractional shared", difference)
    assert difference < 1e-6
    client.__exit__(None, None, None)


def test_huge_finite_rectangle_has_unit_membership(tmp_path, monkeypatch):
    sr = 8000
    x = np.full((1, 24000), 0.75, dtype=np.float32)
    client, lane, headers = _open_client(tmp_path, monkeypatch, x, sr)
    params = dict(
        t0=0,
        t1=3,
        sr=sr,
        selection_t0=-1e308,
        selection_t1=1e308,
        f_lo=-1e308,
        f_hi=1e308,
        n_fft=16,
        win_length=16,
        window="hann",
        window_param=0,
    )
    response = client.get(f"/api/lanes/{lane}/pcm", params=params, headers=headers)
    assert response.status_code == 200
    actual, _ = decode_frame(response.content)
    error = np.max(np.abs(actual - x))
    print("unit mask", error)
    assert error < 1e-6
    client.__exit__(None, None, None)


def test_narrow_gaussian_valid_right_edge_matches_oracle(tmp_path, monkeypatch):
    from test_spectral_mask import oracle

    sr = 8000
    x = np.random.default_rng(42).normal(0, 0.15, (2, 29)).astype(np.float32)
    client, lane, headers = _open_client(tmp_path, monkeypatch, x, sr)
    params = dict(
        sr=sr,
        selection_t0=0.000021,
        selection_t1=28.3 / sr,
        f_lo=207.123,
        f_hi=2340.321,
        n_fft=32,
        win_length=21,
        window="gaussian",
        window_param=0.03625,
    )
    expected = oracle(x, sr, 32, 21, "gaussian", 0.03625, 0.000021, 28.3 / sr, 207.123, 2340.321)
    for a, b in [(0, 29), (25, 29)]:
        response = client.get(
            f"/api/lanes/{lane}/pcm", params=params | {"t0": a / sr, "t1": b / sr}, headers=headers
        )
        assert response.status_code == 200
        actual, _ = decode_frame(response.content)
        error = np.max(np.abs(actual - expected[:, a:b]))
        print("gaussian edge", a, error)
        assert error < 1e-6
    client.__exit__(None, None, None)


@pytest.mark.parametrize("masked", [False, True])
@pytest.mark.parametrize(
    "t0,t1,start,end",
    [
        (-1e308, 1, 0, 8000),
        (0, 1e308, 0, 24000),
        (-1e308, 1e308, 0, 24000),
        (1, 1e308, 8000, 24000),
        (-1e308, -1, 0, 0),
        (4, 1e308, 24000, 24000),
    ],
)
def test_pcm_extreme_finite_chunk_bounds(tmp_path, monkeypatch, masked, t0, t1, start, end):
    from test_spectral_mask import oracle

    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    sr = 8000
    x = np.full((1, 24000), 0.75, dtype=np.float32)
    path = tmp_path / "finite-bounds.wav"
    sf.write(path, x.T, sr, subtype="FLOAT")
    expected = oracle(x, sr, 16, 16, "hann", 0, 0, 3, 0, 4000) if masked else x
    headers = {"Authorization": "Bearer secret"}
    with TestClient(
        create_app("secret", "cpu", [str(path)]), raise_server_exceptions=False
    ) as client:
        lane = client.get("/api/session", headers=headers).json()["lanes"][0]["id"]
        params = dict(t0=t0, t1=t1, sr=sr)
        if masked:
            params.update(
                selection_t0=0,
                selection_t1=3,
                f_lo=0,
                f_hi=4000,
                n_fft=16,
                win_length=16,
                window="hann",
                window_param=0,
            )
        response = client.get(f"/api/lanes/{lane}/pcm", params=params, headers=headers)
        print(
            "finite bounds",
            masked,
            t0,
            t1,
            response.status_code,
            response.json()["error"] if response.status_code != 200 else "",
        )
        assert response.status_code == 200
        actual, meta = decode_frame(response.content)
        assert actual.dtype == np.float32 and actual.shape == (1, end - start)
        assert meta["sr"] == sr and meta["first_sample"] == start
        if end > start:
            error = np.max(np.abs(actual - expected[:, start:end]))
            print("finite bounds error", masked, t0, t1, error)
            assert error < 1e-6
