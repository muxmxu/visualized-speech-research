---
name: vsr-speech-visualization
description: Speech / audio 可视化标准，Visualized! Speech Research（vsr）的配套 skill。画、检查或比较语音与音频时使用：waveform、spectrogram、mel 与模型 feature、F0、频谱与 LTAS、数据集统计、RIR 与混响，包括模型输出与 ground truth 的对比，以及 research log、论文、slides 用图。规定视图选择、命名 preset、dBFS 标定、dB 范围、colormap、对比规则与参数报告格式，并要求用 vsr（vsr.show 交互查看、vsr.plot 静态图、vsr scan 数据集检查）。Use when plotting, inspecting or comparing speech/audio signals, spectrograms, mel features, TTS/VC/vocoder outputs, speech datasets, or room impulse responses.
---

# Speech visualization 标准（vsr）

目标：同一个项目里的所有语音图（探索时看的、research log 里的、论文和 slides 上的）可以互相比较、能复现、不误导。vsr 是这套标准的实现：交互查看用 vsr 页面，静态图用 `vsr.plot`，数值都来自 `vsr.dsp`。

## 不可违反

- 不自己重写 STFT、mel、dB 换算或 RIR 指标，一律用 `vsr.dsp`（它与 vsr 页面是同一份实现、同一套标定）。当前环境没有 vsr 时先安装（`pip install -e <vsr 仓库>`；画静态图加 `[plot]`）；装不上就停下来告诉 Human，不用自写代码代替。
- 展示"模型看到的特征"时，参数取自模型的 config（sr、n_fft、win、hop、n_mels、fmin、fmax、mel 归一化、log 方式），不用 preset 重新计算。找不到 config 就问。
- 每张对外的图都附 spec line（§5）。没有 spec line 的图不进 research log、论文或 slides。
- 对比图的所有面板用同一 preset、同一 dB 范围、同一 colormap，并共享时间轴。
- 不为好看而改数据：不做未声明的平滑、降噪、归一化；不靠裁剪频率范围或抬高 dB 下限来隐藏伪影。确实需要局部放大时，同时给出全频带版本，或在图注里写明。
- 不用 jet / rainbow / hsv 一类的 colormap。

## 1. 先确定问题，再选视图

| 要回答的问题 | 视图 | preset |
|---|---|---|
| 信号是否完好：削波、截断、DC、静音、爆音、丢帧 | waveform + 频谱，并且先听 | `analysis` |
| 共振峰、辅音、瞬态 | wideband 频谱 | `wideband` |
| 谐波、F0、颤音、嗓音质量 | narrowband 频谱 + F0 overlay | `narrowband` |
| 模型输入 / 输出的特征 | feature lane，按模型 config 解释 | 模型 config |
| 合成 / 转换 / vocoder 输出与 GT 的差别 | 并排对比 + LTAS 叠加；逐样本对齐时加差值图 | 与 GT 相同 |
| 整体音色、频谱倾斜、有效带宽 | LTAS（mean + p10–p90） | `ltas` |
| 数据集质量与分布 | `vsr scan` 指标表、直方图、按组 LTAS | `ltas` |
| 混响、房间特性 | RIR：EDC + 拟合线，倍频程 T30 / EDT / C50 / DRR | RIR 默认参数 |

一张图回答一个问题。需要多种视图时分开出图，不把无关的视图拼在一起。

## 2. Presets

数值定义在本目录的 `presets.toml`，它是唯一来源，vsr 页面和 `vsr.plot` 读的是同一个文件。换算成样本数时调用 `vsr.resolve_preset(name, sr)`，不手算。

| preset | 窗 | 窗长 | hop | 频率范围 | 用途 |
|---|---|---|---|---|---|
| `analysis` | hann | 约 40 ms（取 2 的幂个样本） | 窗长 / 4 | 0 – Nyquist，线性 | 默认检查 |
| `wideband` | hann | 5 ms（约 290 Hz 带宽） | 1 ms | 0 – 8 kHz | 共振峰、辅音 |
| `narrowband` | hann | 32 ms（约 45 Hz 带宽） | 5 ms | 0 – 5 kHz | 谐波、F0 |
| `ltas` | hann | 约 85 ms（2 的幂） | 窗长 / 4 | 50 Hz – Nyquist，log | 长时平均频谱，dB/Hz，只用活动帧 |

需要偏离 preset 时传 overrides，例如 `vsr.resolve_preset("narrowband", sr, f_max_hz=8000)`；spec line 会记录实际参数。

## 3. 数值与坐标轴

- 频谱值为 dBFS：频率落在 bin 中心、幅度为 1 的正弦读作 0 dBFS，与窗无关。Welch 平均在功率域做，分位数在 dB 域取。LTAS 用 dB/Hz（PSD）：不同采样率、不同窗长的结果只有在这个单位下才能直接比较。
- dB 范围默认 `auto80`：ceil = 参与显示的数据的最大 dB 向上取整到 10 dB，floor = ceil − 80。对比时 ceil 取所有面板的最大值。实际范围写进 spec line。
- 时间轴单位用 s（总长不足 1 s 时用 ms）；频率轴用 Hz 或 kHz。用 log 频率轴时，轴标签必须写明 log。
- mel / feature 图：纵轴按 mel 通道的中心频率标 Hz 刻度，并注明 `mel(n_mels, fmin–fmax, htk|slaney)`。
- 必须有 colorbar，并写单位：`dBFS`、`dB`（未标定）、`ln |mel|`、`value`（raw）。
- colormap：频谱与 feature 图用 `magma`；差值图用 `RdBu_r`，以 0 dB 为中心对称，范围写明；需要黑白印刷时用 `gray_r`。vsr 页面的 `heat` 只用于交互查看，不用于对外的图。

## 4. 对比规则（模型输出 vs GT 等）

1. 采样率不同时，先显式重采样到同一个 sr，并在图注写明方法（例如 `scipy.signal.resample_poly`）。
2. 响度：要么都不归一化，要么全部用同一种方法（峰值或 LUFS）归一化，并写明。
3. 顺序固定：GT 在最上（或最左），其后是各系统；系统名与论文 / log 中一致。
4. 写明样例来源：utterance ID 与选择方式（随机种子、全部、按某指标排序取第 k 个）。不挑最好看的样例冒充典型样例。
5. 差值图（dB 之差）只用于逐样本对齐的信号，例如 copy-synthesis、vocoder 重建、降噪前后。时长不同的 TTS / VC 输出改用 LTAS 叠加和 F0 曲线对比。
6. 需要 Human 判断听感时，同时推送音频（vsr 的 lane 可直接播放），不只给图。

## 5. Spec line 与出处

每张对外的图（log、论文、slides）都附三项：

1. spec line：取自 `vsr.plot` 的返回值或 vsr 页面的 "Copy spec"，不手写。例如
   `vsr-spec v1 | preset=narrowband | sr=24000 | window=hann | win=768 | hop=120 | n_fft=2048 | y=linear 0-5000Hz | db=[-80,0] dBFS | cmap=magma`
2. 数据出处：文件路径，或数据集名 + utterance ID；模型输出另写 checkpoint 与 git commit。
3. 生成这张图的脚本路径。

research log 里把这三项写在图的正下方；论文里把 spec line 的要素写进图注或实验设置一节。

## 6. 工作流程

### A. 与 Human 一起交互查看

1. 检查 vsr server：`$VSR_HOME/runtime.json`（默认 `~/.vsr/runtime.json`）存在，且其中的进程在运行。没有运行时请 Human 启动 `vsr`，不要自己在后台启动常驻 server。
2. 推送，lane 名用 Human 看得懂的名字：

   ```python
   import vsr
   vsr.show({"gt": gt_wav, "proposed": pred_wav}, sr=22050)
   vsr.show(mel, kind="feature", sr=22050, hop=256,
            freq_axis=dict(type="mel", n_mels=80, fmin=0, fmax=8000, htk=False),
            value_scale="ln_magnitude", name="mel_pred")
   ```

3. 告诉 Human 推送了哪些 lane，以及建议用哪个 preset 看哪种现象。不要为了"看一眼"去生成 PNG。

### B. 静态图（log / 论文 / slides）

```python
import vsr
fig, spec = vsr.plot.compare({"GT": gt, "Proposed": ours, "Baseline": base}, sr=24000, preset="narrowband")
vsr.plot.savefig(fig, "fig/compare_utt0123.png", dpi=300)   # 写入 vsr-spec 元数据；普通 fig.savefig 不会写
print(spec)                                       # 写进 log 或图注
```

- 差值图：`vsr.plot.compare(..., diff=("GT", "Proposed"))`；F0 叠加：`vsr.plot.spectrogram(ax, x, sr, preset="narrowband", f0=(times, hz))`。
- 单图：`vsr.plot.spectrogram(ax, x, sr, preset=...)`；频谱 / LTAS：`vsr.plot.spectrum(ax, {...}, sr)`；RIR：`vsr.plot.rir(ax, h, sr)`。
- 论文图另外导出 PDF 或 SVG。期刊 / 会议对尺寸与字号的要求按其官方说明，本 skill 不规定。

### C. 数据集检查

```bash
vsr scan /data/corpus_a /data/corpus_b -o metrics.csv --ltas ltas.npz --group-by source
```

先看 `error`、`clip_ratio`、`bandwidth_hz`、`lead_silence_s` / `trail_silence_s` 的分布，再看按组的 LTAS。报告时给出所用阈值与命中的文件数，并列出异常文件的 ID，不只给均值。

### D. RIR

用 `vsr.dsp.rir_metrics(h, sr)`。报告 T30（动态范围不足时退到 T20 并说明）、EDT、C50、DRR，以及每项的 r² 与噪声底。没有做噪声截断的 Schroeder 积分结果不能当作 T60 报告。

## 7. 出图前检查

- [ ] 视图与问题匹配（§1）；preset 或模型 config 明确
- [ ] 对比面板的 preset、dB 范围、colormap、时间轴一致（§4）
- [ ] 有带单位的 colorbar；频率轴刻度类型写明
- [ ] spec line、数据出处、脚本路径齐全（§5）
- [ ] 没有未声明的处理（平滑、降噪、归一化、裁剪）
