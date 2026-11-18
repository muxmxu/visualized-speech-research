import pytest
from fastapi.testclient import TestClient

from vsr import resolve_preset, spec_line
from vsr.server.app import create_app


@pytest.mark.parametrize(
    "sr,triples",
    [
        (16000, [(512, 128, 512), (80, 16, 512), (512, 80, 1024), (1024, 256, 1024)]),
        (22050, [(1024, 256, 1024), (110, 22, 512), (706, 110, 2048), (2048, 512, 2048)]),
        (24000, [(1024, 256, 1024), (120, 24, 512), (768, 120, 2048), (2048, 512, 2048)]),
        (44100, [(2048, 512, 2048), (221, 44, 1024), (1411, 221, 4096), (4096, 1024, 4096)]),
        (48000, [(2048, 512, 2048), (240, 48, 1024), (1536, 240, 4096), (4096, 1024, 4096)]),
    ],
)
def test_resolution(sr, triples):
    for name, triple in zip(("analysis", "wideband", "narrowband", "ltas"), triples, strict=True):
        p = resolve_preset(name, sr)
        assert (p["win_length"], p["hop"], p["n_fft"]) == triple
        assert p["f_max_hz"] <= sr / 2


def test_spec_line():
    assert spec_line(
        {
            "name": "narrowband",
            "sr": 24000,
            "window": "hann",
            "win": 768,
            "hop": 120,
            "n_fft": 2048,
            "y": "linear 0-5000Hz",
            "db": [-80, 0],
            "cmap": "magma",
        }
    ) == (
        "vsr-spec v1 | preset=narrowband | sr=24000 | window=hann | win=768 | hop=120"
        " | n_fft=2048 | y=linear 0-5000Hz | db=[-80,0] dBFS | cmap=magma"
    )


def test_preset_route(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    with TestClient(create_app("secret", "cpu")) as client:
        assert client.get("/api/presets?sr=16000").status_code == 401
        headers = {"Authorization": "Bearer secret"}
        assert client.get("/api/presets?sr=0", headers=headers).status_code == 422
        response = client.get("/api/presets?sr=16000", headers=headers)
        assert response.status_code == 200
        assert set(response.json()) == {"analysis", "wideband", "narrowband", "ltas"}
        assert response.json()["analysis"]["n_fft"] == 512


def test_overrides_and_resolved_spec():
    preset = resolve_preset("narrowband", 24000, win_length=512, hop=100, n_fft=1024, db=[-80, 0])
    assert (preset["win_length"], preset["hop"], preset["n_fft"]) == (512, 100, 1024)
    assert "window=hann | win=512 | hop=100 | n_fft=1024 | y=linear 0-5000Hz" in spec_line(preset)


def test_feature_spec_line():
    params = {
        "object": "feature",
        "sr": 22050,
        "hop": 256,
        "y": "mel(80, 0-8000Hz, slaney)",
        "value": "ln_magnitude",
        "range": [-11.5, 2.0],
        "cmap": "magma",
    }
    assert spec_line(params) == (
        "vsr-spec v1 | feature | sr=22050 | hop=256 | "
        "y=mel(80, 0-8000Hz, slaney) | value=ln_magnitude | "
        "range=[-11.5,2.0] | cmap=magma"
    )


def test_preset_bounds_and_truthful_specs():
    for sr in (16000, 22050, 24000, 44100, 48000):
        assert resolve_preset("analysis", sr)["f_max_hz"] == sr / 2
        assert resolve_preset("wideband", sr)["f_max_hz"] == min(8000, sr / 2)
        assert resolve_preset("narrowband", sr)["f_max_hz"] == min(5000, sr / 2)
    assert "db=auto80" not in spec_line(resolve_preset("analysis", 16000))
    assert "overrides=" not in spec_line(resolve_preset("analysis", 16000, window="hann"))
    assert "window=kaiser(8.6)" in spec_line(resolve_preset("analysis", 16000, window="kaiser"))
    assert "window=gaussian(0.125)" in spec_line(
        resolve_preset("analysis", 16000, window="gaussian")
    )


def test_preset_no_store(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    with TestClient(create_app("secret", "cpu")) as client:
        response = client.get("/api/presets?sr=16000", headers={"Authorization": "Bearer secret"})
        assert response.headers["cache-control"] == "no-store"


def test_lazy_dsp():
    import subprocess
    import sys

    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys, vsr; assert 'vsr.dsp' not in sys.modules; "
            "assert vsr.dsp.stft_db; assert 'fastapi' not in sys.modules",
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


def test_preset_route_includes_resource_definitions(tmp_path, monkeypatch):
    from importlib.resources import files

    import vsr.presets as presets

    source = files("vsr").joinpath("skills/vsr-speech-visualization/presets.toml").read_text()
    resource = tmp_path / "skills" / "vsr-speech-visualization" / "presets.toml"
    resource.parent.mkdir(parents=True)
    resource.write_text(
        source + "\n[extra]\nwindow='hann'\nwin_ms=40\npow2_win=true\n"
        "hop_ratio=0.25\nnfft_factor=1\nyscale='linear'\nf_min_hz=0\n"
        "f_max_hz=0\ndb='auto80'\ncmap='magma'\n"
    )
    monkeypatch.setattr(presets, "files", lambda package: tmp_path)
    monkeypatch.setenv("VSR_HOME", str(tmp_path / "home"))
    with TestClient(create_app("secret", "cpu")) as client:
        response = client.get("/api/presets?sr=16000", headers={"Authorization": "Bearer secret"})
        assert response.status_code == 200
        assert response.json()["extra"]["n_fft"] == 512
