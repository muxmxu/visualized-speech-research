import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from vsr.server.app import create_app


def test_auth_open_mutate_and_source(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    path = tmp_path / "signal.wav"
    sf.write(path, np.array([0, 0.5, -0.5], dtype=np.float32), 8000)
    original = path.read_bytes()
    with TestClient(create_app("secret", "cpu")) as client:
        assert client.get("/api/session").status_code == 401
        assert (
            client.get("/api/session", headers={"Authorization": "Bearer wrong"}).status_code == 401
        )
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect("/ws?token=wrong"):
                pass
        with pytest.raises(WebSocketDisconnect) as exc:
            with client.websocket_connect("/ws"):
                pass
        assert exc.value.code == 1008
        headers = {"Authorization": "Bearer secret"}
        with client.websocket_connect("/ws?token=secret") as ws:
            response = client.post("/api/open", json={"paths": [str(path)]}, headers=headers)
            assert response.status_code == 200
            assert ws.receive_json()["type"] == "lanes_changed"
            lane = response.json()["lanes"][0]
            assert client.patch(
                f"/api/lanes/{lane['id']}", json={"mute": True}, headers=headers
            ).json()["mute"]
            assert ws.receive_json()["type"] == "lanes_changed"
        assert client.get("/api/session", headers=headers).json()["lanes"][0]["name"] == path.name
    assert path.read_bytes() == original


def test_upload_and_error_payload(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    original = tmp_path / "original.wav"
    sf.write(original, np.zeros(12, dtype=np.float32), 8000)
    with TestClient(create_app("secret", "cpu")) as client:
        headers = {"Authorization": "Bearer secret"}
        response = client.post(
            "/api/upload?name=upload.wav", content=original.read_bytes(), headers=headers
        )
        assert response.status_code == 200
        assert response.json()["lanes"][0]["source"] == "upload:upload.wav"
        response = client.post("/api/upload?name=../escape.wav", content=b"x", headers=headers)
        assert response.status_code == 400
        assert set(response.json()) == {"error", "detail", "traceback"}


def test_unexpected_handler_error_returns_traceback(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    missing = tmp_path / "missing"
    with TestClient(create_app("secret", "cpu"), raise_server_exceptions=False) as client:
        response = client.get(
            "/api/fs/list",
            params={"path": str(missing)},
            headers={"Authorization": "Bearer secret"},
        )

    assert response.status_code == 500
    payload = response.json()
    assert set(payload) == {"error", "detail", "traceback"}
    assert payload["error"] == "FileNotFoundError"
    assert payload["detail"] == f"[Errno 2] No such file or directory: '{missing}'"
    assert isinstance(payload["traceback"], str)
    assert "Traceback (most recent call last):" in payload["traceback"]
    assert "in list_files" in payload["traceback"]
    assert f"FileNotFoundError: {payload['detail']}" in payload["traceback"]


@pytest.mark.parametrize("field", ["offset", "gain_db"])
@pytest.mark.parametrize("value", ["1e400", "-1e400"])
def test_nonfinite_lane_values_rejected_without_mutation(tmp_path, monkeypatch, field, value):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    path = tmp_path / "signal.wav"
    sf.write(path, np.array([0, 0.5, -0.5], dtype=np.float32), 8000)
    headers = {"Authorization": "Bearer secret"}
    with TestClient(create_app("secret", "cpu"), raise_server_exceptions=False) as client:
        lane = client.post("/api/open", json={"paths": [str(path)]}, headers=headers).json()[
            "lanes"
        ][0]
        response = client.patch(
            f"/api/lanes/{lane['id']}",
            content=f'{{"{field}":{value},"name":"changed"}}',
            headers=headers | {"Content-Type": "application/json"},
        )
        assert response.status_code == 422
        assert set(response.json()) == {"error", "detail", "traceback"}
        assert client.get("/api/session", headers=headers).json()["lanes"][0] == lane
        assert (
            client.get(
                f"/api/lanes/{lane['id']}/waveform?t0=0&t1=1&width=2", headers=headers
            ).status_code
            == 200
        )
        response = client.patch(f"/api/lanes/{lane['id']}", json={field: 0.25}, headers=headers)
        assert response.status_code == 200
        assert response.json()[field] == 0.25


@pytest.mark.parametrize("endpoint,extra", [("waveform", "width=2"), ("pcm", "sr=8000")])
@pytest.mark.parametrize("field", ["t0", "t1"])
@pytest.mark.parametrize("value", ["nan", "inf", "-inf"])
def test_nonfinite_time_queries_rejected(tmp_path, monkeypatch, endpoint, extra, field, value):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    path = tmp_path / "signal.wav"
    sf.write(path, np.zeros(8, dtype=np.float32), 8000)
    headers = {"Authorization": "Bearer secret"}
    with TestClient(create_app("secret", "cpu"), raise_server_exceptions=False) as client:
        lane = client.post("/api/open", json={"paths": [str(path)]}, headers=headers).json()[
            "lanes"
        ][0]
        times = {"t0": "0", "t1": "1"} | {field: value}
        response = client.get(
            f"/api/lanes/{lane['id']}/{endpoint}?t0={times['t0']}&t1={times['t1']}&{extra}",
            headers=headers,
        )
        assert response.status_code == 422
        assert set(response.json()) == {"error", "detail", "traceback"}
