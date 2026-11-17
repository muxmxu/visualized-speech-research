# vsr 设计 review（2026-11-16，独立 reviewer）
对象：`docs/DESIGN.md`（v1）、`AGENTS.md`、`src/vsr/skills/vsr-speech-visualization/`（`SKILL.md`、`presets.toml`）。未注明文件的行号指 DESIGN.md。evidence 为 verified 的条目附来源或本机复算结果；复算环境：M 系列 Mac，numpy 2.4.6，scipy 1.18.0，torch 2.15.0，matplotlib 3.11.2。
## verdict: revise

2 个 blocker、15 个 major、5 个 minor。blocker 1 会让 Human 点名要的 T-F 框功能在 3 个频谱 preset 中的 2 个下直接报错，而现有验收测不出来；blocker 2 是一组按原文无法通过的数值验收项，无人值守时 agent 只能停下，或者改实现去迁就测试。

## issues

### 1. [blocker] T-F mask 的 STFT 在 win_length < n_fft 时 ISTFT 报错，且接口传不到所需参数
- location：§15 L491–492；§7 L193（`/pcm`）；§9.4 L316；§5 L153
- problem：mask 规定 `hop = n_fft/4`、窗取 lane 当前的窗。preset `wideband`（24 kHz：win 120、n_fft 512，hop 128 > win）与 `narrowband`（win 768、n_fft 2048，hop 512）下 `torch.istft` 因窗重叠条件不满足抛 RuntimeError，框内试听、删除、提取都不能用。M1 / M3 的 mask 测试只会用默认 preset（win = n_fft），测不出来。另外后端不保存显示设置（L153），`spectral_attenuate / spectral_extract` 的参数里没有 n_fft 与 window，`/pcm` 没有 win_length，后端无从得知「lane 当前的窗」。
- evidence：verified。torch 2.15.0 实测上述两组参数 istft 均报错；改为 hop = win_length/4 后三个 preset 的 stft→istft 往返误差 < 1e-6。
- required_fix：mask 的 STFT 定义为 `win_length` 取 lane 当前值、`hop = win_length // 4`、`n_fft` 不变；`/pcm` 与两个 `spectral_*` op 的参数显式包含 `n_fft, win_length, window, window_param`；M1 的 mask 测试对 `analysis / wideband / narrowband` 参数化。

### 2. [blocker] 多个数值验收项按原文无法通过，或结果取决于未规定的细节
- location：§19 L600、L601、L611、L621、L641、L649、L650
- problem 与 required_fix（逐项）：
  - L601 welch 对 scipy：DC 与 Nyquist bin 相差 6.02 dB（density 相差 3.01 dB），因为 scipy 的单边谱不对这两个 bin 加倍，而 §8.1 不做特殊处理；scipy 默认 `detrend="constant"`、`noverlap=nperseg//2`。改为：测试写明 `detrend=False, nperseg=win_length, noverlap=win_length−hop, nfft=n_fft`，帧从 round(t0·sr) 起、不 padding，比较时排除 k=0 与 k=n_fft/2。
  - L600 0 dBFS：1 kHz 只在部分 (sr, n_fft) 下落在 bin 中心（16 kHz / 512 是 bin 32；48 kHz / 2048 是 42.67，hann 读数约 −0.63 dB）。改为：f = k·sr/n_fft（例：sr=16000、n_fft=512、k=32），只取不含 padding 的内部帧，kaiser 的 β 写明。
  - L641 bandwidth ≤ 2 bin：理想 brick-wall 8 kHz 噪声在 preset `ltas`（48 kHz、4096）下读数偏高 3.3 bin（hann 旁瓣）；用 `resample_poly` 做的 16→48 kHz fixture 读 9258 Hz，偏 107 bin（重采样滤波器的过渡带）。改为：带限噪声用 FFT 置零构造，容差 ≤ 8 bin；上采样 fixture 只断言 bandwidth < 10 kHz。
  - L649 C50 / D50：若沿用 L648 的噪声载波，单次实现的 C50 标准差为 0.15 dB（48 kHz）至 0.26 dB（16 kHz），0.2 dB 容差会随机失败；D50 是比值，不能用 dB 容差；无噪声信号上 Lundeby 的行为未定义。改为：h[n] = exp(−6.91·n/(sr·T60))，`use_lundeby=False`，C50 容差 0.2 dB、D50 绝对误差 0.01；另规定 Lundeby 找不到噪声底时 t_c 取末尾、不加补偿。
  - L650 ESS：已知 IR 的直达声在第 0 个样本时，带限产生的非因果振铃被 `[0, IR 长度)` 截掉，实测误差 −17 至 −37 dB，达不到 −40 dB；直达声前有 5 ms 延迟时为 −57 dB。sr = 16 kHz 时 10 kHz 高于 Nyquist，带通构造不出来。带通的类型与阶数、−80 dB 的参考都没有给。改为：sr = 48000；IR 的前置延迟 ≥ 5 ms；噪声为相对扫频 RMS −80 dB；带通为 `butter(8, [100, 10000], "bandpass")` + `sosfiltfilt`。
  - L621：gain_db = −inf（Delete）时「≥ |gain_db| − 1 dB」没有意义。改为：测试用 −20 dB，正弦距框边 ≥ 8 bin。L611：未说明「相对误差」在哪个域；若经 f16 缓存，−80 dB 附近的量化步长为 0.0625 dB。改为：用 `vsr.dsp.mel_db` 的 f32 输出换回功率后比较。
- evidence：verified。以上数值均为本机 numpy / scipy 复算。L648 的 T30 测试复算可通过（见 notes）。

### 3. [major] 倍频程的 C50 / C80 / D50 会丢掉直达声能量
- location：§14.1 L466–467、L471–472；§1 L28；`SKILL.md` L30
- problem：频带信号由时间反转滤波得到，滤波器对直达声的响应全部落在直达声之前；「之后的计算都从 onset 开始」会把这部分能量切掉。onset 在 broadband 还是在各频带上检测也没有写。DRR 是否分频带，§1 与 skill 写倍频程，L472 只给 broadband。
- evidence：verified。合成 IR（直达声 + T60 0.6 s 的尾部，DRR 约 −7 dB）上，按原文算得的 C50 比 window-before-filter 低 0.6–2.6 dB（250 Hz：2.29 对 4.87 dB），直达声越强偏差越大。ISO 3382-1 建议先对 broadband IR 做时间窗再滤波（二手来源：AIJ benchmark 说明页；未核对标准原文）。
- required_fix：onset 只在 broadband h 上检测一次。频带的 C50 / C80 / D50 / DRR：先按 onset 与 onset + 50 / 80 ms 把 broadband h 切成 early、late，各自经正向倍频程滤波后求总能量。反向滤波只用于 EDC 与衰减时间，EDC 的起点取频带信号上按同一规则重新检测的 onset。统一 DRR 是否分频带。

### 4. [major] 「单轨的多个频谱预览」没有覆盖
- location：§1 L21–22；§5 L153；§9.2 L274–279
- problem：每条 lane 只有一套显示设置和一个 W / S / W+S 视图，同一条音频不能同时以多组 FFT 参数或多种 mode 显示（例如 wideband 与 narrowband 上下对照）。也没有复制 lane 的操作可以替代。
- evidence：inferred。依据是 Human 原话的字面意思；若原意只是「参数可调」，本条降为 note。
- required_fix：前端显示状态按 view id 保存；lane header 加「Add view」，新增一行绑定同一个 lane id，参数独立，播放与编辑共用。后端不需要改。

### 5. [major] 播放时的采样率转换由 Chrome 以线性插值完成
- location：§3 L71；§9.4 L315
- problem：以 lane 的 sr 建 AudioBuffer，在 44.1 / 48 kHz 的 AudioContext 里播放 16 / 22.05 / 24 kHz 语音会带镜像成分与高频衰减，用来听 vocoder 伪影时不可信。
- evidence：verified。Chromium `audio_buffer_source_handler.cc`：buffer 与 context 采样率不同时走 `ProcessInterpolatedPath`，注释为 "Linear interpolation"，文件内没有 sinc resampler。
- required_fix：`/pcm` 增加 `sr` 参数，后端用 `resample_poly`（§11 的混音已经要用）转到 `ctx.sampleRate` 再返回；AudioBuffer 的采样率始终等于 context。

### 6. [major] 无参数的 Save 会用 WAV 覆盖非音频的 source 文件
- location：§15 L494；§5 L125
- problem：source 可能是 `.pt / .npy / .safetensors`、mp3 / ogg、同一个文件拆出的多条 lane、`push:` 或 `upload:`。「path 为空表示写回 source 路径」对这些情况没有规定，照字面实现会覆盖 tensor 文件，或对有损格式重新编码。
- evidence：inferred。
- required_fix：只有 source 是 wav / flac 文件、且该 lane 是这个文件对应的唯一 lane 时允许 path 为空；其余返回 400，前端转 Save As。输出格式由扩展名决定，只支持 wav / flac。

### 7. [major] 测试与 e2e 会读写真实的 `~/.vsr`、`~/.cache/vsr`、`~/vsr-recordings`
- location：§4 L82–102；§13 L452；§20 L656
- problem：Playwright「启动真实后端」会改写 Human 正在运行的 vsr 的 `runtime.json`（token、port）；pytest 会写真实的数据集缓存与录音目录。
- evidence：inferred。
- required_fix：增加环境变量 `VSR_HOME`（默认 `~/.vsr`），runtime.json、config、plugins、数据集缓存与 recordings 默认目录都由它推出；pytest 与 Playwright 一律指向临时目录并使用随机端口。

### 8. [major] 整条 lane 一次算完 STFT：峰值内存与耗时没有上限，`lane_db_max` 在不缓存路径下没有定义，缩小视图时超出 §17 预算
- location：§8.3 L225–232；§8.1 L211；§17 L547
- problem：缓存值是整条 lane 的 dB 矩阵，默认路径一次算完；结果超过上限一半时「只计算请求区间」，但 `auto80` 需要整条 lane 的最大值。全视图的 max-pool 每次请求都遍历整个矩阵。
- evidence：verified。实测 10 min、48 kHz、mono：preset `wideband`（win 240、hop 48、n_fft 1024）整条计算 CPU 3.4 s、MPS 1.4 s，进程峰值 RSS 5.0 GiB（结果 f16 587 MiB）；n_fft 2048 / hop 512 整条 0.41 s（预算内），但全视图 max-pool 0.11–0.18 s / 通道，超过 80 ms。
- required_fix：整条计算改为按时间分块（每块输出 ≤ 64 MiB）写入预分配的 f16；`lane_db_max` 在分块时求出，并按缓存键单独保存这个标量，不缓存路径也先做一遍只求标量的分块扫描；缓存另存时间方向 ×8、×64 的 max 金字塔；pool 窗口取绝对帧号网格（从 k·p 起），平移时图像才不会闪动。

### 9. [major] 并发与取消没有定义
- location：§3 L62；§9.3 L307；§12 L429；§13 L444；§4 L106
- problem：sync 路由在线程池中无法取消，前端 abort 之后整条 STFT 仍会算完；同一缓存键的并发请求（立体声两个通道、频谱与 spectrum 同时到）会重复计算；多个线程同时使用 MPS，数据集的 8 个 worker 也都用 `compute_device`。
- evidence：inferred。
- required_fix：缓存按键 single-flight（每个键一把锁）；重计算入口共用一个 semaphore（并发 1）；数据集扫描固定用 CPU；session 的 lane 列表读写加锁。

### 10. [major] Linux 上缺 PortAudio 时 `import sounddevice` 直接失败；macOS 无麦克风权限时录到全 0 且不报错
- location：§2 L36；§10 L360；§11；§18 L583
- problem：场景 B 的服务器通常没有 PortAudio，模块级 import 会让 server 启动不了；`import vsr`（训练脚本里的 `vsr.show`）也不应连带 import server 一侧的依赖。
- evidence：verified。sounddevice 安装文档：pip 只在 macOS / Windows 附带 PortAudio，其他平台需自行安装。macOS 权限被拒时 CoreAudio 返回全 0 的 buffer（多份开发者报告）。
- required_fix：`sounddevice` 只在 `record/` 与 `/rir/measure` 内延迟 import，失败时 `/audio/devices` 返回空列表与原因；`vsr/__init__.py` 不在模块级 import server、record、librosa、sounddevice；加一个 `sounddevice` import 失败（monkeypatch）时 server 仍能启动的测试。录音开头 1 s 全为 0 时，UI 提示检查麦克风权限，并写入 `manual-checks.md`。

### 11. [major] `/pcm` 一次取最长 10 分钟的 f32
- location：§7 L193；§9.4 L315–318
- problem：48 kHz 立体声 10 分钟为 230 MB / lane（48000 × 2 × 4 × 600），每按一次 Space 取一次，多 lane 成倍；经 SSH 隧道时要等几秒到几十秒才起播。loop 时各 lane 的 buffer 长度不同会逐圈错位。`/pcm` 没有 `channel` 参数，C > 2 的 lane 会被 Web Audio 按 quad / 5.1 规则 downmix 或丢弃通道。
- evidence：inferred（字节数为计算值）。
- required_fix：起播只取前 20 s，之后按 20 s 分块预取并用 `start(when)` 首尾相接，去掉 10 分钟上限；loop 时各 lane 的 buffer 补零到同一长度；`/pcm` 加 `channel`，C > 2 时只播所选通道。

### 12. [major] LTAS 的 dBFS 读数随窗长变化，跨采样率的数据集对比会出现假的电平差
- location：§13 L448–449、L457；`presets.toml` L45–56
- problem：峰值标定下，噪声类成分的读数正比于窗的等效噪声带宽。`pow2_win` 使 ltas 的窗长随 sr 变化：16 kHz 为 64 ms（ENBW 23.4 Hz），24 / 48 kHz 为 85.3 ms（17.6 Hz），两者相差 1.25 dB，而 M6 的 fixture 正好包含不同 sr。固定网格的「插值」在高频只取单个 bin（10 kHz 处网格间距约 290 Hz，bin 间距约 12 Hz）。
- evidence：verified（计算）。
- required_fix：数据集的 `ltas` 向量与分组对比一律用 `unit=db_per_hz`；网格上每点取其 1/24 倍频程带内各 bin 的功率平均，带内没有 bin 时才做线性插值。

### 13. [major] `active_frames_only` 的判定没有定义，并且依赖 M5 才交付的 `vad.energy`
- location：`presets.toml` L56；§12 L434；§13 L448；§16 L528、L533；§19 L598、L609
- problem：M1 交付 preset 与 `vsr.dsp.welch`，M2 交付 `vsr.plot.spectrum(preset="ltas")`，都需要活动帧判定。VAD 的帧（20 ms / 10 ms）与 Welch 的帧（85 ms、hop = 窗长 / 4）如何对应也没有写。
- evidence：inferred。
- required_fix：活动帧函数放进 `vsr.dsp` 并在 M1 交付，`vad.energy` 与数据集复用它；规则写明为：Welch 帧的中心落在活动的 VAD 帧内时计入。

### 14. [major] `vsr.plot` 把 spec 写进 PNG 元数据没有可用的机制
- location：§16 L512、L531–533；`SKILL.md` L98；§19 L614
- problem：matplotlib 只在调用 `savefig(..., metadata=...)` 时接受元数据，Figure 上没有可预置的字段；skill 的示例是普通的 `fig.savefig(path)`；`spectrogram(ax, ...)` 用的还是调用者自己的 Figure。
- evidence：verified。matplotlib 3.11.2：Figure 没有 metadata 属性，普通 `savefig` 的 PNG 只有 `Software` 文本块，传 `metadata={"vsr-spec": ...}` 才会写入。
- required_fix：`compare` 返回重写了 `savefig` 的 Figure 子类；`spectrogram / spectrum` 把 spec 记在 `ax.figure` 上，并提供 `vsr.plot.savefig(fig, path, **kw)`。skill 示例是否相应修改由 Human 决定。

### 15. [major] preset 的 `cmap` 与 UI 默认 colormap 冲突；缺 preset 接口；取整方式未定义
- location：§8.1 L211；§9.5 L333；`presets.toml` L17；§16 L506–510；§7
- problem：默认 preset `analysis` 的 `cmap = "magma"`，§9.5 说交互默认为 `heat`（Human 要的是 Audition 的配色），AGENTS.md 又要求实现服从 preset。`heat` 只有文字描述，没有色标数值。§7 没有让前端取得 preset 的接口。`round` 的舍入方式未定义：44.1 kHz 下 wideband 的 win 与 narrowband 的 hop 都是 220.5，Python 的 `round` 得 220，四舍五入得 221，而 L603 的测试包含 44.1 kHz。
- evidence：verified（计算）。
- required_fix：写明 UI 应用 preset 时不取 `cmap`（UI 默认 `heat`，`vsr.plot` 使用 preset 的 cmap）；给出 `heat` 的 RGB 控制点；增加 `GET /api/presets?sr=`，返回换算后的参数；取整定义为 `floor(x + 0.5)`。

### 16. [major] 一部分 e2e 验收项没有可由程序判定的标准
- location：§19 L594、L620、L636、L643；`AGENTS.md` L8
- problem：「mute / solo 生效」「该区域在频谱上变暗」「F0 曲线叠加在频谱上」「LTAS 对比图正确显示」没有说明断言什么。
- evidence：inferred。
- required_fix：逐项写明观察量。播放：master 之后接 AnalyserNode，RMS 与播放头经 `window.__vsr_test` 暴露。频谱：比较操作前后 `/spectrogram` 返回的框内均值。图：断言曲线条数与数据点数。其余项标为「截图供 Human 查看，不作为门槛」。

### 17. [major] `vsr skill install --codex` 的目标目录不是 Codex 读取的位置
- location：§16 L502；§19 L615
- evidence：verified。Codex 文档（Agent Skills）：user 级目录为 `$HOME/.agents/skills`，没有提到 `~/.codex/skills`；支持 symlink 的 skill 目录。
- required_fix：`--codex` 的目标改为 `~/.agents/skills/`。

### 18. [minor] 频谱视口的行列映射与 header 语义没有定义
- location：§8.3 L227–232；§19 L602
- problem：pool 后第 j 列覆盖哪些帧、`t_first_center / t_step` 指列中心还是左边界、`f_axis.lo / hi` 指首末行中心还是边界、log 行的带边界与插值坐标、mel 模式下前端如何把行换成 Hz，都没有写；L602 的测试无从对照。
- evidence：inferred。
- required_fix：第 j 列覆盖帧 [j·p, (j+1)·p)（p 为整数，绝对网格），时间取所覆盖帧中心的中点；header 返回每行的中心频率数组；log 第 i 行的带为 f_lo·r^(i/H) 至 f_lo·r^((i+1)/H)（r = f_hi/f_lo），插值在 Hz 上线性，取行的几何中心。

### 19. [minor] 窗函数与 `db_per_hz` 的定义不完整
- location：§8.1 L209；§8.4 L240
- problem：hann 以外的窗是 periodic 还是 symmetric、gaussian 的 σ 的含义没有写；torch 没有现成的 blackmanharris。`db_per_hz` 只说「同 scipy」，但它是 RMS² 口径，且 DC / Nyquist 处与 scipy 相差 3.01 dB（见 issue 2）。
- evidence：verified（scipy 复算）。
- required_fix：所有窗由 `scipy.signal.get_window(..., win_length, fftbins=True)` 生成后转 tensor；写出 `db_per_hz = 10·log10(A²·(Σw)² / (2·sr·Σw²))`，并注明口径。

### 20. [minor] RIR 其余未定的参数
- location：§14.1 L468–472；§14.2 L480–482
- problem：Lundeby 的初始平均窗、每 10 dB 的区间数、噪声估计段、迭代上限；`noise_floor_db` 的参考；C50 / C80 的 late 能量是否加补偿项；DRR 窗早于 onset 时如何处理；反卷积的 FFT 长度，X 是否包含前后静音；`sd.playrec` 之后没有检查 `sd.get_status()`。
- evidence：inferred。
- required_fix：写入取值（建议：30 ms；每 10 dB 5 段；末 10%；最多 5 次；参考为平滑后 |h|² 的峰值；late 加补偿项；FFT 长度为录音全长，X 为整段播放信号）；status 出现 overflow / underflow 时标记本次测量无效并提示重测。

### 21. [minor] 依赖与打包
- location：§18 L560、L583；`AGENTS.md` L17–19
- problem：Python 3.10 没有 `tomllib`，读 `config.toml` 与 `presets.toml` 需要 `tomli`，属于新增运行时依赖，按 AGENTS.md agent 要停下来问。dev 依赖（pytest、ruff、httpx）没有列出。hatchling 默认遵守 `.gitignore`，`src/vsr/web/` 不会进 wheel。
- evidence：verified。Python 3.10 实测 `import tomllib` 失败；Hatch 文档：被 VCS 忽略的文件需用 `artifacts` 选项才会打包。
- required_fix：要求 Python ≥ 3.11；列出 dev 依赖；`[tool.hatch.build] artifacts = ["src/vsr/web/**"]`。

### 22. [minor] 接口与数据模型的零散缺口
- location：§5、§7、§9.2、§10、§11、§12、§15、§16、§19
- problem：(a) 渲染接口的 URL 不含 `version`，若启用浏览器缓存，编辑后会返回旧图。(b) `POST /analyzers/{id}/run` 的返回结构、`Spectrum / Scalars` 结果的存放位置没有定义，`Lane` 没有 `labels` 字段。(c) `/upload` 的存放位置，以及 tensor 文件拖放后如何进入 interpretation 流程。(d) `vsr.show` 的 layout 推断规则与 dict 推送的帧格式。(e) 多 lane 选区编辑后 Cmd+Z 的作用范围；源 lane 编辑后派生 lane 如何处理；`copy` 不应压入 undo 或改 version；`cache_bytes` 是否同时限制 STFT 缓存与 undo。(f) 录音：meter stream 与录音 stream 的交接；开流前取不到 `stream.latency`；没有 armed lane 时按录音键的行为。(g) `spec_line` 只有两个例子，mel mode、log 轴、kaiser 参数、spectrum 图没有格式。(h) M1 需要 §15 的 mask 函数，范围描述没有写；L607 的「恰好一个请求」需限定 mono lane 且 n_fft 为下拉；§17 各行在哪个 milestone 验收没有写。(i) `SKILL.md` L54 的 `gray_r` 不在 §9.5 的列表里；skill 要求 F0 overlay 与差值图，`vsr.plot` 没有对应入口。
- evidence：inferred。
- required_fix：逐项补一句定义。(a) 响应头 `Cache-Control: no-store`。(h) 在 M1 范围中写明「实现 §15 的 mask 函数，不含 edit op」。其余由设计者定。

## notes
- 复算后确认无误的部分：§8.4 的 +3.01 dB 关系（内部 bin 精确成立）；mel 定义与 librosa 一致；`SKILL.md` 的 hann 带宽（1.44/T：5 ms 为 288 Hz，32 ms 为 45 Hz）；ESS 公式；torch 2.15 上 MPS 的 stft / istft 可用（往返误差 3e-6）；L648 的 T30 测试可通过（一个简化的 Lundeby 实现，16 / 48 kHz、三个 T60、各 20 个 seed，最大相对误差 3.5%；不截断时误差为 +20% 至 +1100%，测试有区分力），建议固定 sr 与 seed。
- 可选，不要求本轮处理：`ltas` 改为 `pow2_win = false` 可使窗长与 sr 无关（preset 数值由 Human 决定）；Frequency Analysis 增加「对整个选区做单次 FFT」，用于看 RIR 的频率响应；librosa（numba 等）会随 `pip install vsr` 进入训练环境，可考虑拆成 extra；ε(f) 在 f1 / f2 处改为平滑过渡；共享 home 的集群上 `vsr.show` 应核对 `runtime.json` 的 hostname；上传 R16F 纹理前设 `UNPACK_ALIGNMENT = 1`。
- 未核对：Mantine / dockview / AG Grid / uPlot 的具体 API；ISO 3382-1 原文；sounddevice 全双工在真实硬件上的行为；Audition 的实际色标。Chrome 每页约 16 个 WebGL context 的说法只找到二手来源。
- review 期间仓库里新增了 `docs/WORKFLOW.md` 与 `agent_workspace/`，只读了前者作为背景，不在本次 review 范围内。其中「改变验收标准需 Human 批准」意味着 issue 2 的每一项在实现阶段都会变成一次阻塞。 复算脚本放在 reviewer 的临时目录，未保留。
