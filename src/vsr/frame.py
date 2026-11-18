"""Framed binary transport for NumPy arrays."""

import json
import struct
import sys
from math import prod

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
    if len(frame) < 4:
        raise ValueError("Frame is missing the header length")
    header_len = struct.unpack_from("<I", frame)[0]
    payload_start = (4 + header_len + 7) // 8 * 8
    if payload_start > len(frame):
        raise ValueError("Frame header or padding is truncated")
    header = json.loads(frame[4 : 4 + header_len])
    if not isinstance(header, dict):
        raise ValueError("Frame header must be a JSON object")
    if any(frame[4 + header_len : payload_start]):
        raise ValueError("Frame header padding must contain only zero bytes")
    payload_len = len(frame) - payload_start

    def read(descriptor, offset: int) -> tuple[np.ndarray, int]:
        if not isinstance(descriptor, dict):
            raise ValueError("Frame descriptor must be a JSON object")
        dtype_name = descriptor.get("dtype")
        shape = descriptor.get("shape")
        if not isinstance(dtype_name, str) or dtype_name not in _DTYPES:
            raise ValueError("Unknown frame dtype")
        if not isinstance(shape, list) or any(
            type(dim) is not int or not 0 <= dim <= sys.maxsize for dim in shape
        ):
            raise ValueError("Invalid frame shape")
        dtype = _DTYPES[dtype_name]
        count = prod(shape)
        end = offset + count * dtype.itemsize
        if end > payload_len:
            raise ValueError("Frame payload is truncated")
        array = np.frombuffer(frame, dtype=dtype, count=count, offset=payload_start + offset)
        return array.reshape(shape), end

    end = 0
    if "arrays" in header:
        descriptors = header["arrays"]
        if not isinstance(descriptors, list):
            raise ValueError("Frame arrays must be a list")
        arrays = {}
        for descriptor in descriptors:
            if not isinstance(descriptor, dict):
                raise ValueError("Frame descriptor must be a JSON object")
            name, offset = descriptor.get("name"), descriptor.get("offset")
            if not isinstance(name, str) or name in arrays:
                raise ValueError("Frame array names must be unique strings")
            aligned = (end + 7) // 8 * 8
            if type(offset) is not int or offset != aligned:
                raise ValueError("Frame array offset does not match the aligned payload")
            if any(frame[payload_start + end : payload_start + offset]):
                raise ValueError("Frame array padding must contain only zero bytes")
            arrays[name], end = read(descriptor, offset)
        result = arrays
    else:
        result, end = read(header, 0)
    if end != payload_len:
        raise ValueError("Frame has bytes after its payload")
    return result, header
