# 编写 Analyzer 插件

Analyzer 是放在 `plugin_dirs` 中的 Python 模块，默认目录为 `~/.vsr/plugins`。设置了 `VSR_HOME` 时，默认目录为其下的 `plugins`。可在 `VSR_HOME`（默认 `~/.vsr`）下的 `config.toml` 中用 `plugin_dirs` 指定一个或多个目录。

下例用 WORLD Harvest 将基频曲线叠加在源音频的频谱上。在源码工作树中执行 `uv sync --extra world`，然后用 `uv run vsr serve` 启动。已安装 vsr 时，把可选依赖 `pyworld` 装入当前服务使用的同一 Python 环境。

将下列代码完整保存为插件目录中的 `my_f0.py`。

```python
import numpy as np
import pyworld
import torch

from vsr.api import Param, TimeCurve, analyzer


@analyzer(id="f0.harvest", label="F0 (WORLD Harvest)", version=1, input="audio")
def harvest(
    x: torch.Tensor,
    sr: int,
    *,
    f0_floor: float = Param(71.0, min=40, max=400, unit="Hz", label="F0 floor"),
    f0_ceil: float = Param(800.0, min=200, max=1600, unit="Hz", label="F0 ceiling"),
) -> TimeCurve:
    mono = np.ascontiguousarray(x.numpy().mean(axis=0), dtype=np.float64)
    pitch, times = pyworld.harvest(mono, sr, f0_floor=f0_floor, f0_ceil=f0_ceil)
    pitch[pitch == 0] = np.nan
    return TimeCurve(
        times=times,
        values=pitch,
        unit="Hz",
        overlay="freq",
        y_scale="log",
        labels=["WORLD Harvest"],
    )
```

打开一段语音并选中音频轨，在 **Analyzers** 面板刷新列表，选 **F0 (WORLD Harvest)**，然后点击 **Run**。选区和通道由工作区传入，未画选区时处理整轨。曲线显示在源轨频谱上，可用该轨的叠加曲线按钮切换可见性。保存插件修改后，再点 **Run** 即可用新代码。列表会显示导入错误，运行错误的通知里可展开 traceback。

`input="audio"` 接收 float32 CPU tensor `[C, N]` 和整数采样率 `sr`，选择单通道时仍保留通道维。`input="feature"` 接收 `[F, T]` 和 `sr`，并得到 `frame_rate`、`freq_axis`、`value_scale` 三个关键字参数。用 `Param` 声明可调参数，默认值决定类型，`choices` 生成下拉菜单。需要配置的计算设备时，调用 `vsr.api.compute_device()`。

插件也可返回 `TimeFreqImage`（图像）、`TimeCurve`（曲线）、`Events`（带标签的时间区间）、`Spectrum`（频率分析）、`Scalars`（结果表）或 `Audio`（音轨）。返回的时间以本次输入为原点，应用负责放回源轨时间轴。字段与形状见 [DESIGN §12](DESIGN.md#12-analyzer-插件)。
