"""Compute device selection and numerical self-check."""

import torch


def available_devices() -> list[str]:
    devices = ["cpu"]
    if torch.cuda.is_available():
        devices.extend(f"cuda:{i}" for i in range(torch.cuda.device_count()))
    if torch.backends.mps.is_available():
        devices.append("mps")
    return devices


def self_check(device: str) -> dict[str, float]:
    def calculate(target: str) -> dict[str, torch.Tensor]:
        x = torch.arange(1024, dtype=torch.float32, device=target) / 1024
        window = torch.hann_window(128, device=target)
        spectrum = torch.stft(x, 128, 32, window=window, return_complex=True)
        return {
            "stft": spectrum.cpu(),
            "istft": torch.istft(spectrum, 128, 32, window=window, length=1024).cpu(),
            "rfft": torch.fft.rfft(x).cpu(),
            "matmul": (x[:256].reshape(16, 16) @ x[256:512].reshape(16, 16)).cpu(),
        }

    reference = calculate("cpu")
    candidate = calculate(device)
    return {
        key: (
            torch.linalg.vector_norm(candidate[key] - value) / torch.linalg.vector_norm(value)
        ).item()
        for key, value in reference.items()
    }


def select_device(requested: str) -> dict:
    devices = available_devices()
    selected = requested
    if requested == "auto":
        selected = next((d for d in devices if d.startswith("cuda")), "")
        selected = selected or ("mps" if "mps" in devices else "cpu")
    try:
        errors = self_check(selected)
        if not all(value < 1e-4 for value in errors.values()):
            raise RuntimeError(f"self-check relative error: {errors}")
        return {
            "compute_device": selected,
            "available_devices": devices,
            "self_check": errors,
            "reason": None,
        }
    except (RuntimeError, AssertionError) as exc:
        return {
            "compute_device": "cpu",
            "available_devices": devices,
            "self_check": None,
            "reason": str(exc),
        }
