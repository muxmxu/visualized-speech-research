"""Device exposed to analyzers."""

import torch

_device = "cpu"


def compute_device() -> torch.device:
    return torch.device(_device)
