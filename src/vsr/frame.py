"""Framed binary transport for NumPy arrays."""

import json
import struct

import numpy as np

_DTYPES = {
    "f32": np.dtype("<f4"),
    "f16": np.dtype("<f2"),
    "i16": np.dtype("<i2"),
    "u8": np.dtype("u1"),
}
_NAMES = {dtype.name: name for name, dtype in _DTYPES.items()}


def encode_frame(arrays: np.ndarray | dict[str, np.ndarray], meta: dict | None = None) -> bytes:
    header = dict(meta or {})
    payload = bytearray()

    def append(array: np.ndarray) -> tuple[str, list[int], int]:
        dtype = _NAMES[array.dtype.name]
        payload.extend(b"\0" * (-len(payload) % 8))
        offset = len(payload)
        payload.extend(array.astype(_DTYPES[dtype], copy=False).tobytes(order="C"))
        return dtype, list(array.shape), offset

    if isinstance(arrays, np.ndarray):
        dtype, shape, _ = append(arrays)
        header.update(dtype=dtype, shape=shape)
    else:
        descriptors = []
        for name, array in arrays.items():
            dtype, shape, offset = append(array)
            descriptors.append(dict(name=name, dtype=dtype, shape=shape, offset=offset))
        header["arrays"] = descriptors
    encoded = json.dumps(header, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    prefix = struct.pack("<I", len(encoded)) + encoded
    return prefix + bytes(-len(prefix) % 8) + payload


def decode_frame(frame: bytes) -> tuple[np.ndarray | dict[str, np.ndarray], dict]:
    header_len = struct.unpack_from("<I", frame)[0]
    header = json.loads(frame[4 : 4 + header_len])
    payload_start = (4 + header_len + 7) // 8 * 8

    def read(descriptor: dict) -> np.ndarray:
        dtype = _DTYPES[descriptor["dtype"]]
        shape = descriptor["shape"]
        count = int(np.prod(shape, dtype=np.int64))
        return np.frombuffer(
            frame, dtype=dtype, count=count, offset=payload_start + descriptor.get("offset", 0)
        ).reshape(shape)

    if "arrays" in header:
        return {item["name"]: read(item) for item in header["arrays"]}, header
    return read(header), header
