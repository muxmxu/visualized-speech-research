import json
import struct

import numpy as np
import pytest

from vsr.frame import decode_frame, encode_frame


@pytest.mark.parametrize(
    ("dtype", "values", "expected"),
    [
        ("<i2", [1, -2, 32767], bytes.fromhex("01 00 fe ff ff 7f")),
        ("<f4", [0, 1, -2], bytes.fromhex("00 00 00 00 00 00 80 3f 00 00 00 c0")),
        ("<f2", [0, 1, -2], bytes.fromhex("00 00 00 3c 00 c0")),
        ("u1", [0, 1, 255], bytes.fromhex("00 01 ff")),
    ],
)
def test_single_array(dtype, values, expected):
    source = np.array(values, dtype=dtype).reshape(1, 3)
    frame = encode_frame(source, {"label": "声音", "nested": {"ok": True}})
    header_len = struct.unpack_from("<I", frame)[0]
    start = (4 + header_len + 7) // 8 * 8
    assert frame[4 + header_len : start] == bytes(start - 4 - header_len)
    assert frame[start:] == expected
    decoded, header = decode_frame(frame)
    np.testing.assert_array_equal(decoded, source)
    assert decoded.dtype == source.dtype
    assert header["shape"] == [1, 3]
    assert header["label"] == "声音"
    assert header["nested"] == {"ok": True}


def test_multi_array_alignment_and_noncontiguous_big_endian():
    source = {
        "a": np.array([1, -2, 32767], dtype=">i2"),
        "b": np.arange(12, dtype=">f4").reshape(3, 4)[:, ::2],
        "c": np.array([255], dtype="u1"),
    }
    frame = encode_frame(source, {"tag": 42})
    length = struct.unpack_from("<I", frame)[0]
    header = json.loads(frame[4 : 4 + length])
    start = (4 + length + 7) // 8 * 8
    assert [item["offset"] for item in header["arrays"]] == [0, 8, 32]
    assert frame[start : start + 8] == bytes.fromhex("01 00 fe ff ff 7f 00 00")
    assert frame[start + 8 : start + 32] == struct.pack("<6f", 0, 2, 4, 6, 8, 10)
    decoded, metadata = decode_frame(frame)
    assert metadata["tag"] == 42
    for name, array in source.items():
        np.testing.assert_array_equal(decoded[name], array)
        assert decoded[name].shape == array.shape
