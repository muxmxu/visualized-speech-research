# vsr 设计 closure check（2026-11-16，独立 reviewer）

对象：`docs/reviews/2026-11-16-design-review.md` 的 22 条 issue，对照修订后的 `docs/DESIGN.md`、`AGENTS.md`、`src/vsr/skills/vsr-speech-visualization/`（`SKILL.md`、`presets.toml`），以及 `decisions.md` 的 D10–D12。只判断各条是否关闭，不重新 review；新问题只收由修订直接引入的矛盾或验收项问题。未注明文件的行号指修订后的 DESIGN.md。复算环境：M 系列 Mac，torch 2.15.0（cpu 与 mps）、numpy 2.5.5、scipy 1.18.1、librosa 1.0.1、matplotlib 3.11.2。

## verdict: fail

22 条全部 closed，没有 open 或 partially。fail 的原因是修订新写的两条数值验收项（N1、N2）按字面参数复算不通过，与原 issue 2 属于同一类问题。另有 6 条 minor（N3–N8）。8 条的修法都是一两句话，改完后只需核对这几行，不需要再做一轮完整 review。

## 22 条 issue 的状态

| # | 状态 | 关闭位置 | 备注 |
|---|---|---|---|
| 1 | closed | §15 L526–527；§7 L206；§9.4 L340；§19 L645、L667 | 复算：`hop = win_length // 4` 时 3 个 preset × 5 个 sr（含 44.1 kHz 的奇数窗长 221、1411）ISTFT 均不报错。L645：3 kHz 变化 0.00 dB，500 Hz 衰减 ≥ 128 dB。L667：框内 −20.00 dB，框外 8 bin 处最差 −0.22 dB（16 kHz wideband） |
| 2 | closed | §19 L640、L641、L655、L667、L689、L697、L698；§8.4 L255–258；§14.1 L504 | 七项都按 required_fix 改写。复算：0 dBFS 三种窗误差 ≤ 1e-4 dB；welch 对 scipy（4 个 preset × 3 个 sr × 3 种窗）误差 ≤ 8e-6 dB；bandwidth 偏 +3.3 bin，resample fixture 读 9246–9258 Hz；C50 / D50 与解析值一致到 1e-4；ESS 在前置延迟 5 ms 时为 −52 至 −56 dB。L655 与 welch 分帧各剩一处细节，见 N3 |
| 3 | closed | §14.1 L500–503；§1 L28；`SKILL.md` L30 | 先切段再正向滤波；onset 只在 broadband 检测；DRR 统一为 broadband 与各频带都给 |
| 4 | closed | §1 L22；§5 L166；§9.2 L297–298、L303；§19 L648 | §9.1 L287 仍写「当前 lane 的显示与频谱设置」，见 notes |
| 5 | closed | §3 L71；§7 L206；§9.4 L338；§19 L651 | 与 #11 的分块叠加后有接缝问题，见 N4 |
| 6 | closed | §15 L529；§19 L666 | |
| 7 | closed | §4 L82、L88、L92–98；§13 L486；§19 L634；§20 L706；`SKILL.md` L80 | |
| 8 | closed | §8.3 L239–243、L248；§19 L642、L649 | 从金字塔取数的全视图 pool 实测 1–2 ms。L240 的块上限与 L649 的 RSS 阈值不相容，见 N2 |
| 9 | closed | §4 L115–120、L108；§13 L478；§19 L650 | 取消定义为「不中断，只丢弃结果」并标 shortcut，可接受。`AGENTS.md` 未同步，见 N5 |
| 10 | closed | §4 L122；§11 L422–423；§19 L659、L675、L676 | `manual-checks.md` 没有单列麦克风权限项，由 L676 的自动测试覆盖，视为等价。另见 N8 |
| 11 | closed | §7 L206；§9.4 L338–339 | 见 N4、N7 |
| 12 | closed | §13 L483；`presets.toml` L56；`SKILL.md` L43、L49；§19 L691 | L691 的 fixture 构造有歧义，见 N1 |
| 13 | closed | §8.6 L278；§8.4 L255；§19 L638；`presets.toml` L57 | 见 N6 |
| 14 | closed（等价方案） | §16 L573、L577；`SKILL.md` L98；§19 L658 | 没有用 Figure 子类，改为 `vsr.plot.savefig` 并同步了 skill 示例，机制成立。复算：PNG 的 `vsr-spec` 文本块与 PDF 的 Keywords 都能写入 |
| 15 | closed | §9.5 L357、L359；§7 L208；§16 L535、L544 | |
| 16 | closed | §9.4 L342；§19 L633、L665、L683–684、L691；§20 L707 | L665 复算（白噪声、默认 preset analysis、框 1 s × 2 kHz）：框内均值下降 74–81 dB |
| 17 | closed | §16 L537；§19 L660 | |
| 18 | closed | §8.3 L243、L246、L248；§19 L642 | |
| 19 | closed | §8.1 L223；§8.4 L257–258 | `db_per_hz` 公式与 scipy density 复算一致 |
| 20 | closed | §14.1 L502、L504；§14.2 L515–516；§19 L699 | DRR 窗定为峰值 ±2.5 ms、起点早于 0 时截到 0，不随 onset 调整，已有定义 |
| 21 | closed | §18 L622；`AGENTS.md` L17 | |
| 22 | closed | (a) §7 L202；(b) §7 L213、§5 L160；(c) §7 L198；(d) §10 L398；(e) §5 L139、L168，§15 L528；(f) §11 L420–421；(g) §16 L555；(h) §19 L638、L647，§17 L592；(i) §9.5 L357，§16 L569–570 | |

## 新问题（均由修订引入）

### N1. [major，源自 #12] 跨采样率 LTAS 测试的 fixture 构造有歧义，按字面读法差 4.77 dB
- location：§19 L691
- problem：「同一白噪声分别以 16 kHz 与 48 kHz 生成」有两种读法。若读成两个采样率下各生成一段 RMS 相同的白噪声，两者的 PSD 本来就相差 10·log10(3) = 4.77 dB，dB/Hz 口径下测试必然失败；实现者可能反过来改 `db_per_hz` 的归一化去迁就测试。
- evidence：verified。按 §13 的 LTAS 定义复算（5 个 seed，100 Hz–7 kHz 网格点上的最大差）：RMS 相同的独立噪声 4.9–5.5 dB；PSD 相同的独立噪声（σ_48 = √3·σ_16）在每组 20 s 时 0.65–0.78 dB，100 s 时 0.24–0.29 dB；48 kHz 噪声与它经 `resample_poly(x, 1, 3)` 得到的 16 kHz 版本，每组 20 s 时 0.18–0.26 dB，300 s 时 0.08 dB。
- required_fix：L691 写明构造：两个来源为同一段 48 kHz 白噪声（固定 seed）和它经 `scipy.signal.resample_poly(x, 1, 3)` 得到的 16 kHz 版本，每组总时长 ≥ 20 s。

### N2. [major，源自 #8] 分块上限 64 MiB 与「峰值 RSS < 1.5 GiB」不相容
- location：§8.3 L240；§19 L649
- problem：`torch.stft` 内部先生成加窗后的分帧矩阵（帧数 × n_fft 个 f32），再生成 complex64 结果，中间量约为该块 f16 输出的 8 倍（64 MiB 的块对应约 0.5 GiB）。按 L240 允许的上限实现，L649 在 CPU 上不通过。另外 RSS 峰值是进程级的高水位，在 pytest 进程内测量会包含之前的测试，L649 没有写测量方式。
- evidence：verified。10 min、48 kHz mono、preset wideband（win 240、hop 48、n_fft 1024），独立进程，计算前基线 0.46 GiB（import 加音频），常驻结果 0.66 GiB（矩阵加金字塔）。

  | 每块 f16 输出上限 | 64 MiB | 32 MiB | 16 MiB | 8 MiB | 4 MiB |
  |---|---|---|---|---|---|
  | 峰值 RSS，cpu（GiB） | 2.21 | 1.70 | 1.42 | 1.29 | 1.24 |
  | 峰值 RSS，mps（GiB） | 1.54 | 1.42 | 1.35 | 1.35 | 1.33 |

  整条计算耗时：cpu 在 64 MiB 时 2.2 s、8 MiB 时 1.2 s，块越小越快。
- required_fix：L240 的上限改为每块 f16 输出 ≤ 8 MiB；L649 写明在独立子进程中测量（阈值 1.5 GiB 保留）。

### N3. [minor，源自 #2] 两个数值测试仍取决于未写明的细节
- location：§19 L655；§8.4 L255
- problem 与 evidence（verified）：
  - L655 的比较范围到「最大值 × 1e-8」，接近 float32 FFT 的舍入噪声底。白噪声与类语音噪声的最大相对误差为 1e-6 至 6e-5（通过）；双正弦在 mps 上为 1.9e-4，chirp 在 cpu 上为 2.1e-4、mps 上为 4.5e-4（超过 1e-4）。测试信号没有指定，结果随信号种类变化。
  - §8.4 welch 的「帧」没有写长度。n_fft > win_length 时，取 win_length 个样本再补零到 n_fft，与 scipy 的误差 ≤ 8e-6 dB；按 `torch.stft(center=False)` 取 n_fft 个样本、窗居中，则帧位置整体偏移，narrowband（48 kHz）上的误差为 0.26 dB，超过 L641 的 0.05 dB。
- required_fix：L655 的比较范围改为「大于最大值 × 1e-6」（此时四种信号在两个设备上都 ≤ 4e-5）；§8.4 写明「每帧取 win_length 个样本，n_fft > win_length 时补零到 n_fft」。

### N4. [minor，源自 #5 × #11] `/pcm` 逐块重采样会在 20 s 接缝处产生瞬态；L651 的比较对象不明确
- location：§7 L206；§9.4 L338；§19 L651
- problem：`resample_poly` 把块外当作 0。每个 20 s 块单独重采样时，接缝两侧的输出与整条重采样不同，每 20 s 出现一次瞬态，与 #5 要解决的「播放可信」相抵。L651 的「与直接调用 `resample_poly` 的结果一致」没有说明是对切片还是对整条调用。带 T-F mask 的 `/pcm` 在块边界有同样的问题。
- evidence：verified。逐块重采样与整条重采样相比，接缝处的最大误差：白噪声为信号峰值的 2.6%–9.2%，1 kHz 正弦为 0.2%–3.6%（16 → 48 kHz、22.05 → 48 kHz、24 → 44.1 kHz、48 → 44.1 kHz），影响 0.3–1.2 ms；接缝以外误差为 0。
- required_fix：§7 写明 `/pcm` 的结果等于对整条 lane 重采样（带 mask 时先对整条做 mask）后的对应切片，实现上可在块两侧多取样本再裁掉，或缓存整条结果；L651 改为「相邻两个 20 s 分块拼接后，与整条 `resample_poly` 的结果逐样本一致」。

### N5. [minor，源自 #9] `AGENTS.md` 与「数据集扫描固定用 CPU」矛盾；semaphore 的范围没有排除扫描
- location：`AGENTS.md` L43；§4 L108、L119；§13 L478
- problem：`AGENTS.md` L43 写「torch 计算一律经 `compute_device`，不写死 `"cpu"`」，§4 与 §13 要求扫描固定在 CPU。§4 L119 把 Welch 列入并发数为 1 的 semaphore，而扫描的 8 个 worker 都要调用 Welch；若 semaphore 加在 DSP 函数内，扫描会被串行化并阻塞交互请求。
- evidence：inferred。
- required_fix：`AGENTS.md` L43 加例外「数据集扫描除外，见 DESIGN §4」；§4 L119 写明该 semaphore 只加在交互请求的入口，数据集扫描不经过它。

### N6. [minor，源自 #13] `/spectrum` 的参数表没有 `active_only`，名称与 preset 不一致
- location：§7 L212；§8.4 L255；`presets.toml` L57
- problem：§8.4 规定 `active_only=true` 的行为，§7 的请求体没有这个参数，前端在 Frequency Analysis 面板应用 preset `ltas` 时传不过去。preset 里的键名是 `active_frames_only`。
- evidence：verified（原文）。
- required_fix：§7 L212 的参数表加上该参数；§8.4 的名称改为与 preset 相同的 `active_frames_only`。

### N7. [minor，源自 #11 / #16] 「循环两圈后各 lane 仍对齐」没有可观察量
- location：§19 L633；§9.4 L342
- problem：`window.__vsr_test` 只暴露 master RMS、播放头与频谱响应，无法直接判断多条 lane 是否对齐。与原 issue 16 是同一类。
- evidence：inferred。
- required_fix：写明构造与断言，例如：lane A 为 3 s 的信号 x，lane B 为 −x 的前 2 s，循环选区 0–3 s；第二圈的前 2 s 内 master RMS 比单独播放 A 时低 ≥ 40 dB。

### N8. [minor，源自 #10] import 边界与 skill 示例的写法需要延迟加载子模块
- location：§4 L122；§19 L659；`SKILL.md` L96–98、L116
- problem：L659 要求 `import vsr` 之后 `sys.modules` 里没有 matplotlib，skill 示例却在 `import vsr` 之后直接写 `vsr.plot.compare(...)`、`vsr.dsp.rir_metrics(...)`。`vsr/__init__.py` 不 import 这些子模块时，属性访问会抛 AttributeError；没有验收项覆盖这一点。
- evidence：inferred（Python 的包属性规则）。
- required_fix：§4 L122 加一句「`vsr.dsp`、`vsr.plot` 由 `vsr/__init__.py` 的模块级 `__getattr__` 延迟加载」；L659 的测试加上「之后访问 `vsr.plot` 成功」。

## notes

- verdict 的依据：N1 与 N2 的验收项在文档给出的参数或字面读法下不通过。两者都存在合规的通过方式（改用重采样的噪声、取更小的块），所以不属于「按原文无法通过」；但不改文档时，无人值守的实现者要自己发现原因，并有改实现去迁就测试的风险。
- 措辞残留，不单列为问题：§9.1 L287「当前 lane 的显示与频谱设置」应为「当前 view」（#4 之后显示设置按 view 保存）；`/pcm` 的重采样测试（L651）列在 M1，而播放在 M0 交付，建议移到 M0。
- `vsr.plot.savefig` 只规定了 PNG 与 PDF。matplotlib 的 SVG writer 不接受 `vsr-spec` 这个键（ValueError），可用 `Keywords`；skill 提到导出 SVG，实现时在 §21 记一行即可。
- L665 的 e2e 在 preset wideband 下对小框不成立（0.2 s × 500 Hz 的框只下降 11–13 dB，窗的主瓣比框宽）；默认 preset analysis 下同样的小框下降 45–51 dB。e2e 用默认 preset 即可。
- 未复算：L696 的 T30 / Lundeby 测试（构造未变，原 review 已复算）；Codex 的 skill 目录（#17，沿用原 review 的文档依据）；Playwright 与 Web Audio 相关的 e2e 项；N2 只测了一种合理的分块实现，其他写法的中间量可能不同。
- D11 对可选建议的取舍（不拆 librosa extra、`ltas` 保留 `pow2_win`、ε(f) 不做平滑）与修订后的正文一致，没有引入矛盾。
- 没有修改任何项目文件；`docs/WORKFLOW.md` 未读。复算脚本在 reviewer 的临时目录，未保留。
