"""Lazy access to PortAudio devices."""

from socket import gethostname


def load_sounddevice():
    try:
        import sounddevice
    except (ImportError, OSError) as exc:
        return None, str(exc)
    return sounddevice, None


def describe_devices(sd, reason: str | None) -> dict:
    options = {
        "hostname": gethostname(),
        "devices": [],
        "default_input": None,
        "default_output": None,
        "reason": reason,
    }
    if sd is not None:
        input_id, output_id = sd.default.device
        options["default_input"] = None if input_id < 0 else input_id
        options["default_output"] = None if output_id < 0 else output_id
        fields = ("name", "max_input_channels", "max_output_channels", "default_samplerate")
        options["devices"] = [
            {"id": index} | {field: info[field] for field in fields}
            for index, info in enumerate(sd.query_devices())
        ]
    return options
