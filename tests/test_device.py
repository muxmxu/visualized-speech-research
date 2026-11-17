import pytest

from vsr import device


@pytest.mark.parametrize("target", device.available_devices())
def test_device_relative_error(target):
    assert all(error < 1e-4 for error in device.self_check(target).values())


def test_device_failure_is_visible(monkeypatch):
    def fail(target):
        raise RuntimeError("device failed")

    monkeypatch.setattr(device, "self_check", fail)
    result = device.select_device("cpu")
    assert result["compute_device"] == "cpu"
    assert "device failed" in result["reason"]


def test_nan_self_check_falls_back_with_reason(monkeypatch):
    monkeypatch.setattr(device, "available_devices", lambda: ["cpu", "cuda:0"])
    monkeypatch.setattr(
        device,
        "self_check",
        lambda target: {"stft": float("nan"), "istft": 0.0, "rfft": 0.0, "matmul": 0.0},
    )
    result = device.select_device("cuda:0")
    assert result["compute_device"] == "cpu"
    assert result["reason"] is not None
