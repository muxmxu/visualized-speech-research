"""Bridge the Python codec to the TypeScript interoperability tests."""

import sys

import numpy as np

from vsr.frame import decode_frame, encode_frame

if sys.argv[1] == "produce":
    arrays = {
        "short": np.array([1, -2, 32767], dtype=np.int16),
        "float": np.array([[0, 1, -2]], dtype=np.float32),
        "half": np.array([[1.5, -2]], dtype=np.float16),
        "byte": np.array([0, 255, 7], dtype=np.uint8),
    }
    sys.stdout.buffer.write(encode_frame(arrays, {"label": "声音", "nested": {"ok": True}}))
else:
    arrays, header = decode_frame(sys.stdin.buffer.read())
    meta = {key: value for key, value in header.items() if key not in {"arrays", "dtype", "shape"}}
    sys.stdout.buffer.write(encode_frame(arrays, meta))
