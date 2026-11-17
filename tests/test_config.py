from vsr.config import load_config


def test_config_defaults_and_override(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    assert load_config()["port"] == 8765
    (tmp_path / "config.toml").write_text('port = 1234\ncompute_device = "cpu"\n')
    assert load_config()["port"] == 1234
