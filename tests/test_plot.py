import importlib
import io
import re

import numpy as np
import pytest
import torch

pytest.importorskip("matplotlib", reason="Static plots use the optional 'plot' extra")
plt = importlib.import_module("matplotlib.pyplot")
plot = importlib.import_module("vsr.plot")
image = importlib.import_module("PIL.Image")

SR = 8000


@pytest.fixture(autouse=True)
def noninteractive_figures():
    plt.switch_backend("Agg")
    yield
    plt.close("all")


def sine(amplitude=0.5, samples=4000):
    times = np.arange(samples) / SR
    return (amplitude * np.sin(2 * np.pi * 1000 * times)).astype(np.float32)


def test_spectrogram_axis_settings_and_f0_overlay():
    fig, ax = plt.subplots()
    line = plot.spectrogram(
        ax,
        np.stack([sine(), sine(0.25)]),
        SR,
        db=(-90, -5),
        f0=([0.05, 0.1], [100, 125]),
        yscale="log",
        cmap="gray_r",
    )
    assert ax.get_title() == "Channel 1"
    assert ax.get_xlabel() == "Time (ms)"
    assert ax.get_xlim() == (0, 500)
    assert ax.get_ylabel() == "Frequency (Hz, log)"
    assert ax.get_yscale() == "log"
    assert ax.get_ylim() == (31.25, 4000)
    assert ax.collections[0].get_clim() == (-90, -5)
    assert ax.collections[0].get_cmap().name == "gray_r"
    assert fig.axes[-1].get_ylabel() == "dBFS"
    assert ax.lines[0].get_label() == "F0"
    np.testing.assert_array_equal(ax.lines[0].get_xdata(), [50, 100])
    np.testing.assert_array_equal(ax.lines[0].get_ydata(), [100, 125])
    assert "y=log 31.25-4000Hz | db=[-90,-5] dBFS | cmap=gray_r" in line


@pytest.mark.parametrize("cmap", ["jet", "rainbow", "hsv", "heat", "inferno", "viridis", "RdBu_r"])
def test_spectrogram_rejects_palettes_outside_the_static_plot_standard(cmap):
    fig, ax = plt.subplots()
    with pytest.raises(ValueError, match="magma or gray_r"):
        plot.spectrogram(ax, sine(), SR, cmap=cmap)
    assert not ax.collections
    assert fig.axes == [ax]


def test_mel_spectrogram_labels_and_f0_use_bin_center_coordinates():
    from librosa import hz_to_mel, mel_frequencies

    fig, ax = plt.subplots()
    center_frequencies = mel_frequencies(14, fmin=50, fmax=3500, htk=True)[1:-1]
    f0_hz = center_frequencies[[2, 8]]
    spec = plot.spectrogram(
        ax,
        sine(),
        SR,
        mode="mel",
        n_mels=12,
        fmin=50,
        fmax=3500,
        htk=True,
        f0=([0.05, 0.1], f0_hz),
    )
    mesh = ax.collections[0]
    assert mesh.get_array().shape[0] == 12
    edges = mesh.get_coordinates()[:, 0, 1]
    np.testing.assert_allclose(
        (edges[:-1] + edges[1:]) / 2, hz_to_mel(center_frequencies, htk=True)
    )
    np.testing.assert_allclose(ax.lines[0].get_ydata(), hz_to_mel(f0_hz, htk=True))
    assert ax.get_ylabel() == "Frequency (Hz, mel(12, 50-3500Hz, htk))"
    assert [label.get_text() for label in ax.get_yticklabels()] == [
        f"{center_frequencies[index]:.4g}" for index in [0, 2, 4, 6, 8, 11]
    ]
    assert fig.axes[-1].get_ylabel() == "dBFS"
    assert "mode=mel(12, 50-3500Hz, htk)" in spec
    assert "y=linear 50-3500Hz" in spec


@pytest.mark.parametrize(
    ("pair", "sign"),
    [(("GT", "Proposed"), 1), (("Proposed", "GT"), -1)],
)
def test_compare_uses_shared_scales_and_signed_sample_aligned_difference(pair, sign):
    fig, spec = plot.compare({"Proposed": sine(0.25), "GT": sine()}, SR, waveform=True, diff=pair)
    panels = [ax for ax in fig.axes if ax.get_title()]
    assert [ax.get_title() for ax in panels] == [
        "GT",
        "GT",
        "Proposed",
        "Proposed",
        " − ".join(pair),
    ]
    assert all(panels[0].get_shared_x_axes().joined(panels[0], axis) for axis in panels[1:])
    assert all(axis.get_xlim() == (0, 500) for axis in panels)
    assert panels[-1].get_xlabel() == "Time (ms)"
    assert panels[0].get_ylabel() == "Amplitude"
    assert panels[0].get_shared_y_axes().joined(panels[0], panels[2])
    np.testing.assert_array_equal(panels[0].lines[0].get_ydata(), sine())

    gt, proposed, difference = [panels[index].collections[0] for index in (1, 3, 4)]
    assert gt.get_clim() == proposed.get_clim() == (-80, 0)
    assert gt.get_cmap().name == proposed.get_cmap().name == "magma"
    assert difference.get_cmap().name == "RdBu_r"
    low, high = difference.get_clim()
    assert low == -high < 0
    assert difference.norm(0) == 0.5
    np.testing.assert_array_equal(
        difference.get_array(), sign * (gt.get_array() - proposed.get_array())
    )
    np.testing.assert_allclose(difference.get_array()[32, 20], sign * 20 * np.log10(2), rtol=1e-6)
    assert [axis.get_ylabel() for axis in fig.axes if not axis.get_title()] == [
        "dBFS",
        "dBFS",
        "dB",
    ]
    first_spec, difference_spec = spec.splitlines()
    assert "db=[-80,0] dBFS | cmap=magma" in first_spec
    assert f"db=[{low},{high}] dB | cmap=RdBu_r" in difference_spec


def test_compare_displays_all_channels_with_the_same_range():
    x = np.stack([sine(0.01), sine(0.08)])
    fig, _ = plot.compare({"GT": x, "Other": sine(0.001, samples=8000)}, SR)
    panels = [ax for ax in fig.axes if ax.get_title()]
    assert [ax.get_title() for ax in panels] == ["GT · Channel 1", "GT · Channel 2", "Other"]
    assert all(axis.collections[0].get_clim() == (-100, -20) for axis in panels)
    assert panels[-1].get_xlabel() == "Time (s)"
    assert all(axis.get_xlim() == (0, 1) for axis in panels)


def test_compare_draws_bfloat16_waveform_at_original_amplitudes():
    samples = torch.tensor(np.stack([sine(1.25), sine(0.25)]), dtype=torch.bfloat16)
    fig, _ = plot.compare({"GT": samples}, SR, waveform=True)
    waveform = next(ax for ax in fig.axes if ax.get_ylabel() == "Amplitude")
    np.testing.assert_array_equal(
        [line.get_ydata() for line in waveform.lines], samples.float().numpy()
    )
    assert waveform.lines[0].get_ydata().max() == 1.25


def test_difference_rejects_unequal_lengths_and_channel_counts():
    with pytest.raises(ValueError, match="sample-aligned"):
        plot.compare({"A": sine(), "B": sine(samples=3999)}, SR, diff=("A", "B"))
    with pytest.raises(ValueError, match="same number of channels"):
        plot.compare({"A": sine(), "B": np.stack([sine(), sine()])}, SR, diff=("A", "B"))


def test_identical_signals_still_use_zero_as_difference_color_center():
    x = sine()
    fig, _ = plot.compare({"A": x, "B": x}, SR, diff=("A", "B"))
    difference = fig.axes[2].collections[0]
    assert difference.get_clim() == (-1, 1)
    assert difference.norm(0) == 0.5
    np.testing.assert_array_equal(difference.get_array(), 0)


def test_spectrum_draws_calibrated_ltas_and_statistic_interval():
    fig, ax = plt.subplots()
    spec = plot.spectrum(ax, {"GT": sine()}, SR)
    assert ax.get_xscale() == "log"
    assert ax.get_xlim() == (50, 4000)
    assert ax.get_xlabel() == "Frequency (Hz, log)"
    assert ax.get_ylabel() == "dB/Hz"
    assert [line.get_label() for line in ax.lines] == ["GT mean"]
    assert [collection.get_label() for collection in ax.collections] == ["GT p10–p90"]
    frequencies, db = ax.lines[0].get_data()
    peak = np.argmax(db)
    assert frequencies[peak] == 1000
    np.testing.assert_allclose(db[peak], 10 * np.log10(0.5**2 * 512 / (3 * SR)), rtol=1e-6)
    assert spec.startswith("vsr-spec v1 | spectrum | sr=8000 | window=hann | win=512")
    assert "stats=mean,p10,p90" in spec and spec.endswith(" dB/Hz")


def test_savefig_writes_png_text_and_pdf_keywords(tmp_path):
    fig, spec = plot.compare({"GT": sine(), "Other": sine(0.25)}, SR, diff=("GT", "Other"))
    png = tmp_path / "comparison.png"
    metadata = {"Title": "Speech comparison"}
    plot.savefig(fig, png, dpi=80, metadata=metadata)
    with image.open(png) as saved:
        assert saved.text["vsr-spec"] == spec
        assert saved.text["Title"] == "Speech comparison"
    assert metadata == {"Title": "Speech comparison"}

    regular = io.BytesIO()
    fig.savefig(regular, format="png")
    with image.open(regular) as saved:
        assert "vsr-spec" not in saved.text

    pdf = io.BytesIO()
    plot.savefig(fig, pdf, format="pdf", metadata={"Keywords": "audio"})
    keywords = re.search(rb"/Keywords \(([^)]*)\)", pdf.getvalue())
    assert keywords is not None
    assert keywords.group(1).replace(rb"\n", b"\n") == ("audio\n" + spec).encode()
