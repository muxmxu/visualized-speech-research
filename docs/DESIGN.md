# Visualized! Speech Research（vsr）设计文档（v1）

> 读者：实现者（Codex / GPT）与 Human 审阅者。本文件是唯一事实源：与代码冲突时以本文件为准。实现中做出的补充决定追加到 §21。

## 0. 定位与原则

Visualized! Speech Research（缩写 vsr）是面向 speech / acoustics 研究的本地音频分析工作台：Audition 式的波形 + 频谱交互，Python + PyTorch 后端；能直接打开 torch tensor、接收训练脚本推送的 tensor、批量分析数据集、测量和分析 RIR，并且只写一个 Python 函数就能增加新的分析视图，不需要改前端。

原则：

1. 计算全部在 Python（torch / numpy / scipy）里。前端只负责显示与交互，不实现 DSP。唯一例外：colormap 与 dB 显示范围在 shader 内换算，保证即时响应。
2. 前端按视口请求数据：后端只返回当前屏幕像素需要的数据量，文件长度不影响前端内存与带宽。
3. 新分析 = 新 analyzer 插件（Python 函数 + 声明的输出类型）。前端对每种输出类型只有一个通用 renderer。
4. 研究工具的数值必须可信：每个 DSP 量写清楚定义与标定方式，并有数值测试。

## 1. 范围

v1 做：

- 可见工作区图表的矩形裁剪，下载为单页栅格 PDF（§9.7）。
- Audition 式的 UI 与交互（§9.6）：工具、快捷键、选区手柄、浮动工具条、右键菜单都按 Audition 的惯例。
- Lanes 视图：单轨编辑与多轨合为同一个视图，多条 lane 共享时间轴。lane 可显示波形、STFT 频谱、mel 频谱、feature 图（任意 2D tensor）。
- 频谱参数完全可调：n_fft、win_length、hop、window、频率轴刻度、dB 范围、colormap。同一条 lane 可以开多个 view（例如 wideband 与 narrowband 上下对照），各 view 的参数独立。
- Frequency Analysis 面板：播放头 / 鼠标处的单帧 FFT；选区内 Welch 平均（mean / median / p10–p90 / max-hold）；整个选区的单次 FFT（看 RIR 等的频率响应）；多条 lane 叠加对比。
- 打开 wav / flac / ogg / mp3 与 .pt / .pth / .npy / .npz / .safetensors；Python 端 `vsr.show()` 推送 tensor。
- 单轨 / 多轨录音（多输入通道同时录、边放边录 overdub），流式写入磁盘。
- Analyzer 插件系统，内置 F0、能量、VAD、Griffin-Lim。
- 数据集分析：逐文件指标表、直方图 / 散点、LTAS 分组对比。
- RIR：EDC、T20 / T30 / EDT、C50 / C80 / D50、DRR（全频带与倍频程）；ESS 扫频测量。
- 编辑：剪切 / 复制 / 粘贴 / 删除 / 增益 / 淡入淡出 / 归一化；频谱上的 T-F 矩形选框可试听框内声音、删除、调增益、提取为新 lane；undo / redo；保存。

v1 不做（不实现，也不预留接口或配置）：效果器链与 VST / AU、MIDI、自动化包络、一条 lane 多个 clip 与 clip 切分、视频、环绕声像、工程文件（session 只存在内存，录音文件在磁盘上）、Electron / 安装包、多用户与账户、输入监听（用声卡硬件直通）、punch-in / count-in。

## 2. 使用场景与部署形态

- A. 本机：Mac 上运行 `vsr`，Chrome 打开；录音、播放、分析都在本机。
- B. 远程：数据与 GPU 在服务器上。服务器运行 `vsr serve`，本机执行 `ssh -L 8765:127.0.0.1:8765 server` 后用本机 Chrome 打开。播放在浏览器里，声音从本机发出；录音设备列表属于服务器（通常为空），UI 标明设备所在的主机名。
- C. 训练脚本 / notebook 里调用 `vsr.show(x, sr=...)`，tensor 出现在已打开的页面中。

由此决定：**播放在浏览器（Web Audio），录音与 RIR 测量在后端（sounddevice / PortAudio）**。后端录音支持多通道、采样级的放录同步，也不经过浏览器的回声消除 / AGC。

## 3. 架构

```
Chrome（React + TS）                         Python（FastAPI + uvicorn，单进程）
┌───────────────────────────┐    HTTP      ┌─────────────────────────────────┐
│ dockview 面板布局          │────────────▶│ routes /api/*                    │
│ Lanes：Canvas2D 波形       │ framed binary│ session：lanes、version、undo    │
│        WebGL2 频谱         │◀────────────│ dsp/：stft、spectrum、mel、rir   │
│ uPlot 1D 图 / AG Grid 表   │     WS       │ analyzers/：registry + builtin   │
│ Web Audio 播放             │◀────────────│ record/：sounddevice + writer    │
└───────────────────────────┘    events    │ dataset/：扫描 job + SQLite 缓存 │
                                            └─────────────────────────────────┘
                                                   ▲ framed binary POST
                                    vsr.show()（训练脚本 / notebook）
```

关键决策：

| 项 | 选择 | 理由 |
|---|---|---|
| 形态 | 本地 web server + Chrome 页面 | Human 允许用 Chrome；远程服务器经 SSH 隧道即可用；不需要打包 |
| 后端 | FastAPI + uvicorn，单进程 | 原生 WebSocket（录音电平、进度、推送通知都要用）；sync 路由自动进线程池，torch 运算释放 GIL；pydantic 校验参数。Flask 也能做，但 WebSocket 要另装 flask-sock 一类的扩展，参数校验要自己写。Web 框架与计算设备无关 |
| 前端 | React + TypeScript + Vite | 生态完整，实现者熟悉 |
| UI 组件 | Mantine（dark theme） | 自带 NumberInput / Slider / Select / Tabs / Modal / notifications，适合高密度参数面板 |
| 面板布局 | dockview | Audition 式可停靠、可拖拽、可保存的面板 |
| 频谱渲染 | 自写 WebGL2（R16F 纹理 + 1D colormap LUT） | 改 dB 范围与 colormap 不需要重新请求 |
| 波形渲染 | 自写 Canvas2D | 与频谱共用视口数学，代码量小 |
| 1D 图 | uPlot | 快，支持 log 轴，适合实时更新的频谱曲线 |
| 表格 | AG Grid Community | 10 万行虚拟滚动、排序、过滤现成 |
| 前端状态 | zustand | 小 |
| 播放 | Web Audio（每 lane 一个 AudioBuffer + GainNode） | 远程场景声音在本机发出。后端先把 PCM 重采样到 AudioContext 的采样率（Chrome 自带的重采样是线性插值，听 vocoder 伪影不可信） |
| 录音 / 测量 | sounddevice（后端） | 多通道、playrec 采样级同步、可选设备与采样率 |
| 文件 I/O | soundfile | 稳定；不依赖 torchaudio 的 I/O |
| DSP | torch（stft / istft / fft）、scipy.signal（滤波器、重采样）、`librosa.filters.mel` | mel 与常见 TTS 代码一致 |
| 计算设备 | `compute_device`：cuda / mps / cpu，运行时可切换 | 见 §4「计算设备」 |
| 包管理 | Python 用 uv，前端用 npm | |

## 4. 运行、连接与安全

CLI（入口 `vsr = vsr.cli:main`）：

- `vsr [paths...]`：若本机已有运行中的 server（`$VSR_HOME/runtime.json` 存在、pid 存活、`/api/ping` 可达），把 paths 交给它打开并打开浏览器；否则启动 server、打开浏览器、加载 paths。
- `vsr serve [--host 127.0.0.1] [--port 8765] [--no-browser] [--dev]`。端口被占用时依次尝试后续 10 个端口。`--dev`：不打开浏览器，打印 Vite dev server 地址（带 token）。

安全（不可省略）：

- 默认只绑定 127.0.0.1。`--host 0.0.0.0` 时打印警告。
- 启动时生成 token（`secrets.token_urlsafe(32)`），与 port、pid、hostname 一起写入 `$VSR_HOME/runtime.json`（权限 0600）。浏览器打开 `http://127.0.0.1:<port>/?token=<t>`；前端把 token 存入 sessionStorage 并从地址栏移除。之后所有 `/api` 请求带 `Authorization: Bearer <t>`，WS 用 `?token=`。缺少或错误 → 401。静态资源不需要 token。不发送 CORS 头。
- `torch.load(..., weights_only=True, map_location="cpu")`、`np.load(..., allow_pickle=False)`，不提供关闭开关。
- 保存文件：先写同目录临时文件，再 `os.replace`。只有用户显式 Save 时才写回原路径。

所有本地状态都在 `VSR_HOME`（环境变量，默认 `~/.vsr`）下：`runtime.json`、`config.toml`、`plugins/`、`cache/`、`uploads/`、`recordings/`。测试与 e2e 一律把 `VSR_HOME` 指向临时目录。

配置 `$VSR_HOME/config.toml`（全部可选）：

| 键 | 默认 |
|---|---|
| `recordings_dir` | `$VSR_HOME/recordings` |
| `plugin_dirs` | `["$VSR_HOME/plugins"]` |
| `compute_device` | `auto`（见下文「计算设备」） |
| `cache_bytes` | 2 GiB |
| `port` | 8765 |

Python 客户端 `vsr.show()` 读取 runtime.json；远程推送时用环境变量 `VSR_URL` 与 `VSR_TOKEN`。

计算设备（`compute_device`：`auto` | `cpu` | `cuda` | `cuda:N` | `mps`；CLI `--device` 覆盖配置）：

- 交互计算都在这个设备上做：频谱与频率分析、mel、编辑、RIR；插件通过 `vsr.api.compute_device()` 取得同一设备。数据集扫描固定在 CPU 上多线程运行（§13）。结果搬回 CPU 后再编码返回；STFT 缓存存在 CPU 内存（f16），不占显存。
- `auto` 依次尝试 cuda → mps → cpu。
- 启动时与每次切换时做 self-check：在所选设备上对小信号跑 stft、istft、rfft、matmul，与 CPU 结果比较（相对误差 < 1e-4）。失败则回退到 cpu，并在 UI 中显示原因。
- 设备上只用 float32（MPS 不支持 float64）。需要 float64 的步骤（RIR 直线拟合、Lundeby）在 CPU 上用 numpy 做。
- UI 的 Settings 面板显示当前设备、可用设备与 self-check 结果，可在运行时切换（`POST /api/settings {compute_device}`）；切换后清空计算缓存。
- DSP 数值测试对本机所有可用设备参数化运行。

并发：

- session 的 lane 列表与每条 lane 的数据读写加锁。
- 缓存按键 single-flight：同一个键同时只有一个计算，其他请求等待它的结果。
- 重计算入口（整条 lane 的 STFT / mel 分块计算、analyzer 运行、编辑 op、Welch、RIR）共用一个并发数为 1 的 semaphore；从缓存切片与 pool、数据集扫描的 worker（固定 CPU，§13）不经过它。
- 已开始的计算不中断，前端 abort 只丢弃结果。`# shortcut: 长计算不能取消；需要时改为分块检查取消标志。`

import 边界：`vsr/__init__.py`（`show`、`resolve_preset`、`spec_line`）只 import 标准库、numpy、torch；`vsr.dsp`、`vsr.plot` 由 `vsr/__init__.py` 的模块级 `__getattr__` 在首次访问时 import；fastapi、librosa、sounddevice、matplotlib 都在用到它们的模块里 import。`sounddevice` 只在 `record/` 与 RIR 测量中延迟 import；失败时 `/audio/devices` 返回空列表与原因，server 照常启动（服务器上通常没有 PortAudio）。

## 5. 数据模型（后端，内存中）

每个 server 进程一个 Session，持有有序的 lanes：

```python
@dataclass
class Lane:
    id: str                    # uuid4().hex[:8]
    name: str
    kind: Literal["audio", "feature", "curve", "events"]
    version: int               # 内容每次改变 +1；所有缓存以 (id, version) 为键
    offset: float              # 秒，lane 在 session 时间轴上的起点（多轨对齐用）
    source: str                # 文件路径 | "push:<name>" | "record:<path>" | "upload:<name>" | "analyzer:<id>"
    parent: str | None         # analyzer 派生的 lane 指向源 lane：源 lane 改 offset 时同步，删除时级联
    dirty: bool = False        # 有未保存的修改
    stale: bool = False        # 派生 lane：源 lane 编辑后置 True，UI 显示 stale 标记，重新运行 analyzer 刷新

    # audio
    sr: int | None = None
    data: torch.Tensor | None = None   # audio: float32 [C, N]，CPU；feature: float32 [F, T]
    gain_db: float = 0.0
    mute: bool = False
    solo: bool = False

    # feature
    frame_rate: float | None = None    # 帧 / 秒
    frame_t0: float = 0.0              # 第 0 帧中心的 lane 内时间（秒）
    freq_axis: dict | None = None      # {"type": "linear", "f_max": Hz} | {"type": "mel", "n_mels", "fmin", "fmax", "htk"} | {"type": "index"}
    value_scale: str | None = None     # 见 §8.5

    # curve（TimeCurve 输出）
    times: torch.Tensor | None = None  # [T]
    values: torch.Tensor | None = None # [K, T]
    unit: str | None = None
    y_scale: Literal["linear", "log"] = "linear"
    overlay: bool = False              # True：不作为独立 lane 显示，画在 parent 的频谱上（values 为 Hz）
    labels: list[str] | None = None    # K 条曲线的名称

    # events
    items: list[tuple[float, float, str]] | None = None
```

- 显示设置（STFT 参数、显示模式、colormap、dB 范围、高度）属于前端状态，按 view 保存（一条 lane 可以有多个 view，§9.2）；后端无状态地接受这些参数。
- 时间：前后端统一用 float64 秒；样本索引 = round(t·sr)。lane 内时间 = session 时间 − offset。
- undo：每条 audio lane 一个 snapshot 栈，编辑前复制整条 tensor。一次作用于多条 lane 的编辑共享一个 group id，Cmd+Z 撤销最近的整个 group。`copy` 不压栈、不改 version。snapshot 总量与 STFT 缓存各自以 `cache_bytes` 为上限，超出时丢弃最旧的 snapshot。`# shortcut: 整条复制，长文件耗内存。`

## 6. 传输格式

大数组一律用 framed binary；小结果（少于约 1 万个数）用 JSON。

Framed binary（HTTP body 与 WS binary message 共用）：

```
u32 LE   header_len
bytes    header（UTF-8 JSON）
pad      补 0x00 到 8 字节边界
bytes    payload（little-endian，C-order）
```

header 至少含 `dtype`（`"f32" | "f16" | "i16" | "u8"`）与 `shape`；其余字段为该接口的 meta。需要多个数组时 header 用 `arrays: [{name, dtype, shape, offset}]` 描述，payload 依次拼接（每段 8 字节对齐）。全项目只用一组 Python `encode_frame / decode_frame`（`frame.py`）和一组 TS `encodeFrame / decodeFrame`（`frame.ts`）。

WS `/ws`（server → client，JSON 或 framed）：`lanes_changed`、`record_meter`（约 30 Hz）、`record_state`、`record_preview`（录音中的 min/max 块，framed）、`job_progress`、`plugins_changed`、`error`。前端收到 `lanes_changed` 后重新 GET `/api/session`，不做增量合并。

## 7. HTTP API

前缀 `/api`，全部需要 token。错误返回 4xx / 5xx，body 为 `{"error": str, "detail": str, "traceback": str | null}`；前端用 notification 显示，可展开 traceback。

Session 与文件：

- `GET /ping`
- `GET /session` → lanes 元数据列表（不含数组）
- `GET /fs/list?path=` → 目录项（name、is_dir、size、mtime），只列目录与支持的扩展名
- `POST /open {paths}` → 音频文件直接成为 lane；tensor 文件返回 `{needs_interpretation: true, path, tree}`（§10）

`vsr [paths...]` 含 tensor 文件时，CLI 把以调用方工作目录解析得到的绝对路径交给同一 server，由本次打开的浏览器页接续解释流程。冷启动在 server 开始处理请求前登记路径，并在应用 lifespan 启动时安装过期回调。热启动用现有的鉴权 `POST /open {paths}` 加私有请求头 `X-VSR-Open-Launch: stage` 登记，返回 `{"launch_id": "<id>"}`。CLI 根据 runtime 发出的探测、设置和打开请求均直连本机回环地址，不经环境代理。每次调用使用由 `secrets.token_urlsafe(32)` 生成的独立一次性标识，格式为 43 个 URL-safe 字符。CLI 沿用 §4 的 token 启动地址，只在 URL fragment 附加 `#open=<id>`。前端初始化时用 `history.replaceState` 移除该 fragment，然后用带 Bearer token 的 `POST /open {"paths":[]}` 加 `X-VSR-Open-Launch: <id>` 领取。领取会在读取文件前原子移除登记项，成功后返回单 tensor 的既有解释响应，或对多路径返回 `{"lanes":[...],"interpretations":[...]}`。两数组各自保留参数顺序，`interpretations` 中每项沿用单 tensor 的 `{needs_interpretation: true, path, tree}` 结构。所有文件读取与检查成功后才发布音频 lanes，前端依次使用 §10 的解释对话框，当前项确认成功或取消后进入下一项。未领取的路径只存于 server 内存，最多保留 5 分钟且同时最多 64 项。登记的列表须由绝对路径组成，且至少含一项 §10 支持的 tensor 扩展名（忽略大小写）。非法登记、非空路径领取或非法头返回 422，未知、已领取（含领取后文件处理失败）或过期的标识返回 404，登记满额返回 429，均使用本节错误 body。私有流程的成功响应使用 `Cache-Control: no-store`。浏览器只在当前页面内存中持有领取所得的路径和 tensor tree。此请求头仅用于 CLI 与本应用页面的接续流程。不带该头的 `POST /open` 以及 `POST /upload` 沿用原有请求与响应。

- `POST /open_tensor {path, key_path, interpretation}` → 新 lanes
- `POST /upload?name=`，body 为文件字节（浏览器拖放用）：文件存到 `$VSR_HOME/uploads/<uuid>/<name>`，之后与 `POST /open` 相同（音频直接成为 lane，tensor 文件返回 interpretation 请求）
- `POST /push`，body 为 framed（header 含 name、kind、sr、interpretation）→ 新 lanes，并广播 `lanes_changed`
- `PATCH /lanes/{id} {name?, offset?, gain_db?, mute?, solo?}`、`DELETE /lanes/{id}`、`POST /lanes/reorder {ids}`

渲染数据（GET，参数全在 query string；响应头 `Cache-Control: no-store`）：

- `/lanes/{id}/waveform?t0&t1&width&channel` → §8.2
- `/lanes/{id}/spectrogram?t0&t1&width&height&f_lo&f_hi&yscale&channel&mode&n_fft&win_length&hop&window&window_param&n_mels&fmin&fmax&htk` → §8.3。feature lane 忽略 STFT 参数，按 §8.5 返回，此时 `f_lo / f_hi` 以行号表示。
- `/lanes/{id}/pcm?t0&t1&sr[&channel][&f_lo&f_hi&n_fft&win_length&window&window_param&selection_t0&selection_t1]` → framed f32 [C, N]，播放用。`t0,t1` 是项目时间线上要返回的半开分块区间，按 lane offset 与采样边界换算，并以请求的 `sr`（前端传 `AudioContext.sampleRate`）输出；前端每次最多取 20 s（§9.4）。普通 PCM 不带 mask 参数，后端以 `scipy.signal.resample_poly` 重采样，结果等于整条 lane 重采样后切出对应目标样本；带 `channel` 时只返回该通道。带 mask 时必须同时给出有限且严格递增的 `selection_t0,selection_t1`、频率边界 `f_lo,f_hi` 和画框 view 的 `n_fft,win_length,window,window_param`；前一对是项目时间线上完整 T-F 矩形的时间边界，并非分块边界。减去 lane offset 后，在 lane 的绝对 STFT 网格上按 §15 判断 mask 帧中心。试听保留矩形内的 T-F 内容，超出 §15 的过渡区域后 mask 权重为零，再经 ISTFT 与重采样。参考结果为对整条源 lane 在固定 `win_length // 4` hop 上施加一次 §15 试听 mask，再重采样一次，最后切出请求的目标样本；分块实现须与此一致，包括边缘与拼接处。`n_fft` 与 `win_length` 为正整数，`win_length ≤ n_fft` 且 `win_length // 4 ≥ 1`；window 为 §8.1 的 hann、hamming、blackman、blackmanharris、kaiser 或 gaussian（boxcar 只用于 §8.4 full）。`window_param` 必须为有限数：无参数窗传 0，kaiser 与 gaussian 传当前配置的参数，使用默认值时分别传 8.6 与 0.125；gaussian 的参数须大于 0。HTTP 入口对不完整的 mask 参数组、非有限值、非递增的时间 / 频率边界、无效 FFT / 窗长 / hop 组合、未知或不适用的 window 与无效窗参数返回 4xx 与本节错误 body。
- `/lanes/{id}/data` → curve lane 为 framed（times + values），events lane 为 JSON
- `GET /presets?sr=` → 按 §16 换算后的全部 preset 参数

分析：

- `POST /lanes/{id}/spectrum {t0, t1, channel, method, n_fft, win_length, hop, window, window_param, stats, unit, active_only}` → §8.4
- `GET /analyzers`、`POST /analyzers/{id}/run {lane, t0?, t1?, channel?, params}` → `{kind, lanes, result}`：`lanes` 为新建或更新的 lane id；Spectrum 与 Scalars 的数据放在 `result` 中（Spectrum 为 framed，Scalars 为 JSON），由前端面板保存，不成为 lane。见 §12
- `POST /rir/analyze`、`POST /rir/measure`、`POST /rir/sweep_preview` → §14

编辑与保存见 §15，录音见 §11，数据集见 §13。

## 8. DSP 定义（实现与测试都以此为准）

### 8.1 STFT 与 dB 标定

- `X = torch.stft(x, n_fft, hop_length=hop, win_length=win_length, window=w, center=True, pad_mode="constant", return_complex=True)`。第 k 帧中心位于 lane 内时间 k·hop/sr。
- window：一律用 `scipy.signal.get_window(w, win_length, fftbins=True)` 生成后转为 tensor：`hann`、`hamming`、`blackman`、`blackmanharris`、`("kaiser", β)`（β = window_param，默认 8.6）、`("gaussian", σ)`（σ = window_param·win_length 个样本，默认 0.125）、`boxcar`（只用于 §8.4 的 full）。win_length ≤ n_fft；n_fft > win_length 时窗在帧内居中补零（torch.stft 的行为）。
- 幅度标定：`A = |X| · 2 / sum(w)`，`dB = 20·log10(max(A, 1e-10))`。效果：频率落在 bin 中心、幅度为 1 的正弦读数为 0 dBFS，与窗无关。DC 与 Nyquist bin 不做特殊处理。
- 默认取 preset `analysis`（§16）：win_length = n_fft = 2^round(log2(0.04·sr))（16 kHz → 512，24 kHz → 1024，48 kHz → 2048），hop = n_fft/4，hann。dB 范围 `auto80`：ceil = 整条 lane 的最大 dB 向上取整到 10 dB，floor = ceil − 80（取整条 lane 而不是视口，平移时范围不跳）。

### 8.2 波形视口

请求 [t0, t1] 与宽度 W。令每列样本数 spp = (t1 − t0)·sr / W：

- spp > 1：返回 f32 [C, 3, W]，每列为该列覆盖样本的 (min, max, rms)。列 j 覆盖样本 [floor(s0 + j·spp), floor(s0 + (j+1)·spp))。
- spp ≤ 1：返回 f32 [C, N] 原始样本，header 给 `first_sample`。前端画折线；每个样本 ≥ 6 px 时画样本点。
- 超出文件范围的部分不返回，header 给实际覆盖范围，前端画空白。

### 8.3 频谱视口（核心）

`mode`：`stft`（线性频率 bin）或 `mel`。

1. 取 dB 矩阵。缓存键 (lane id, version, channel, mode, n_fft, win_length, hop, window, window_param, mel 参数)，值为整条 lane 的 f16 dB tensor [F, T]，以及标量 `lane_db_max` 与时间方向 ×8、×64 的 max 金字塔。按字节 LRU，上限 `cache_bytes`。
   - 计算按时间分块：每块 f16 输出不超过 8 MiB（torch.stft 的中间量约为输出的 8 倍），写入预分配的 f16 tensor；块两侧各多取 n_fft/2 个样本，保证与整条计算一致；`lane_db_max` 与金字塔在分块时一并求出。
   - 单个结果大于 `cache_bytes` 的一半时不缓存矩阵：先做一遍只求 `lane_db_max` 的分块扫描（该标量按缓存键单独保存），之后每个请求只计算请求区间。
   - mel：`P = A²`（§8.1 标定幅度的平方），`M = melfb @ P`，melfb = `librosa.filters.mel(sr=sr, n_fft=n_fft, n_mels=n_mels, fmin=fmin, fmax=fmax, htk=htk, norm="slaney")`，`dB = 10·log10(max(M, 1e-20))`。
2. 时间方向：令 n 为中心落在 [t0, t1] 内的帧数。n ≤ W 时原样返回（p = 1）。否则 p = 2^ceil(log2(n / W))，在绝对帧号网格上 pool：第 j 列覆盖帧 [(c0 + j)·p, (c0 + j + 1)·p)，c0 = floor(首帧号 / p)，取 max；p ≥ 8 时从 ×8 层、p ≥ 64 时从 ×64 层取数据，缩短全视图请求的耗时（参考值见 §17）。列时间 = 所覆盖帧中心的平均。网格对齐绝对帧号，平移时像素不闪动。
3. 频率方向（行在显示刻度上等距，行 0 为最低频）：
   - `yscale=linear`：取中心在 [f_lo, f_hi] 内的 bin；bin 数 > height 时每 ceil(bin 数 / height) 个连续 bin 取 max 合为一行，否则原样返回。
   - `yscale=log`：f_lo 不低于 max(20 Hz, sr/n_fft)。令 r = f_hi / f_lo，第 i 行（i = 0..H−1）的带为 [f_lo·r^(i/H), f_lo·r^((i+1)/H))，行中心为几何中心 f_lo·r^((i+0.5)/H)。带内有 bin 中心时取它们的 max；没有时在 Hz 上对相邻两个 bin 的 dB 线性插值，取行中心处的值。
   - `mode=mel`：行即 mel 通道，取中心频率在 [f_lo, f_hi] 内的通道，不重采样。
4. 返回 f16 [H, W']。header：`col_t0`（第 0 列的时间）、`col_dt`（= p·hop/sr）、`cols`、`rows`、`row_freqs`（每行中心频率，Hz）、`f_axis: {scale, lo, hi}`（行带的外边界）、`view_db_max`（本次数据）、`lane_db_max`（供 `auto80` 使用）。前端只按 `row_freqs`、`col_t0`、`col_dt` 定位，不自行推算。

前端 shader：`v = clamp((dB − floor) / (ceil − floor), 0, 1)`，查 colormap LUT。纹理过滤默认 LINEAR（先插值 dB 值再上色），设置中可切到 NEAREST。

### 8.4 频率分析

- `method=frame`：以 t0 为中心取一帧做 FFT，按 §8.1 标定，返回 dBFS。
- `method=welch`：帧从 round(t0·sr) 开始、步长 hop，每帧取 win_length 个样本、加窗后补零到 n_fft，只取完整落在 [t0, t1] 内的帧（不 padding，不 detrend）；逐帧 `P_k = A_k²`。`active_only=true` 时只取中心落在活动帧内的帧（§8.6）。`stats`：`mean`（功率域平均后转 dB）、`median`、`p10`、`p90`（后三者在 dB 域取分位）、`max`（max-hold）。返回 f32 [S, F] 与频率数组。
- `method=full`：对整个 [t0, t1] 做一次 FFT，n_fft 取不小于样本数的 2 的幂（上限 2^24），默认窗 `boxcar`；返回 `20·log10(max(|X|, 1e-10))`（未标定，unit 为 `db`），用于 RIR 等的频率响应。
- `unit=dbfs`（默认，峰值口径：bin 中心的满幅正弦读 0 dB）或 `unit=db_per_hz`（单边 PSD，RMS² 口径）：`db_per_hz = 10·log10(A²·(Σw)² / (2·sr·Σw²))`。
- 与 scipy 的关系（测试用；排除 k = 0 与 k = n_fft/2 两个 bin）：`welch mean, unit=dbfs` = `scipy.signal.welch(x, fs=sr, window=w, nperseg=win_length, noverlap=win_length − hop, nfft=n_fft, detrend=False, scaling="spectrum")` 的 dB + 3.01 dB（scipy 读 RMS²，本工具读峰值²）；`unit=db_per_hz` 与同参数 `scaling="density"` 的 dB 相同。
- 有 T-F 矩形选区时，面板只显示 [f_lo, f_hi]，计算不变。

### 8.5 Feature lane 的数值换算

显示前统一换成 dB 类数值：

| value_scale | 换算 |
|---|---|
| `magnitude` | 20·log10(max(v, 1e-10)) |
| `power` | 10·log10(max(v, 1e-20)) |
| `db` | v |
| `ln_magnitude` | v · 20 / ln 10（如 HiFi-GAN 的 `log(clamp(mel, 1e-5))`） |
| `log10_magnitude` | 20·v |
| `raw` | v（此时 dB 范围控件即数值范围，标签改为 "value"） |

时间方向的 max-pool 规则同 §8.3；频率方向不重采样（行 = tensor 的行）。`freq_axis` 只决定纵轴刻度标签：linear → 第 i 行 = i·f_max/(F − 1) Hz；mel → 第 i 行 = `librosa.mel_frequencies(n_mels + 2, fmin=fmin, fmax=fmax, htk=htk)[1:-1][i]`；index → 行号。complex tensor 先取 abs，value_scale 设为 magnitude。

### 8.6 活动帧

`vsr.dsp.active_frames(x, sr)`：在 mono（多通道取均值）上以 20 ms 窗、10 ms hop 计算帧 RMS dBFS；活动帧 = 帧 RMS > max(帧 RMS) − 40 dB 且 > −70 dBFS。其他帧长的分析（Welch、LTAS）中，一帧的中心落在某个活动帧中心 ±5 ms 内时计为活动。`vad.energy` 插件与数据集指标都复用这个函数。M1 交付。

## 9. 前端

### 9.1 布局（dockview；布局 JSON 存 localStorage）

- 顶部固定条：transport（回到开头、播放 / 暂停、停止、录音、循环）；播放头时间（`h:mm:ss.mmm`，可切换为样本数）；选区 start / end / duration（可直接输入）；armed 时显示输入电平表。
- 中央：Lanes 视图。Dataset 视图也在中央 tab 组打开。
- 左侧：Files（服务器文件浏览 + 最近打开）。
- 右侧 tab 组：Display（当前 lane 的显示与频谱设置：preset 下拉（§16）、各参数、"应用到所有 lane"、"Copy spec"）、Analyzers、Properties（lane 元数据、sr、通道、时长、source、录音警告）、Settings（计算设备，§4）。
- 底部 tab 组：Frequency Analysis、RIR、Record。
- 底部状态栏：hover 读数——lane 名、时间（秒与样本）、频率（Hz；mel 模式另给通道号）、数值（dB 或振幅）。

### 9.2 Lanes 视图

自上而下：时间标尺（自适应刻度）→ overview 条（最长 lane 的整体波形 + 可拖动的视口框，拖框边缘即缩放）→ lanes 列表（可纵向滚动）。

每条 lane：

- 左侧 header：名称、kind 图标、`sr · ch · 时长`、M / S / R（arm，仅 audio）、显示模式 W | S | W+S、多通道时的通道选择、overlay 开关（每个 overlay curve 一个 chip）、Add view、关闭。底边可拖动改高度，默认 160 px。
- Add view：在下方新增一行 view，绑定同一条 lane，显示设置独立（例如 wideband 与 narrowband 对照）。播放、选区与编辑作用于 lane；T-F 选框的 mask 参数取画框所在 view 的设置。
- audio lane 默认 W+S：上 30% 波形、下 70% 频谱，分界可拖。C ≤ 2 时各通道上下堆叠；C > 2 时显示单通道 + 选择器。
- 频谱区左侧画频率轴（Hz / kHz；mel 与 feature lane 按 §8.5 标注），右侧画 dB colorbar（可隐藏）。
- curve lane 用 Canvas2D 画折线（NaN 处断开）；events lane 画区间色块与文字。

视口：全局共享 `{t0, secondsPerPx}`；每个 view 另有 `{f_lo, f_hi, yscale}` 与波形纵向缩放。

| 操作 | 行为 |
|---|---|
| 竖向滚轮 | 纵向滚动 lanes 列表 |
| Ctrl/Cmd + 滚轮；触控板 pinch（Chrome 上表现为带 ctrlKey 的 wheel） | 以鼠标为中心缩放时间 |
| 横向滚轮 / Shift + 滚轮 | 平移时间 |
| Alt + 滚轮（频谱区） | 以鼠标为中心缩放频率；在频率轴上拖动 = 平移频率 |
| Alt + 滚轮（波形区） | 振幅纵向缩放 |
| 单击 | 设播放头，清除选区 |
| 拖动 | 时间选区并选中该 lane；Shift 扩展；在其他 lane 上 Cmd + 拖动把该 lane 加入同一选区 |
| T / E / V（工具栏同样可选） | 时间选区工具（默认）/ 矩形 T-F 选框工具 / 移动工具 |
| E 工具下在频谱区拖动 | 矩形 T-F 选框（时间 × 频率）；拖边与角调整，拖内部平移 |
| V 工具下拖动 lane 内容 | 改 lane 的 offset |
| 双击 | 选中整条 lane |
| Space | 播放 / 停止。有时间选区时只放选区；有 T-F 选框时只放框内的声音（框内时间、框内频率） |
| Delete / Backspace | 时间选区：删除该段；T-F 选框：删除框内成分（spectral delete） |
| 右键选区 / 选框 | 菜单：播放、删除、增益…、静音、提取为新 lane、在 Frequency Analysis 中显示、缩放到选区 |
| L | 循环开关 |
| `=` / `-` / `0` / `Z` | 放大 / 缩小 / 显示全部 / 缩放到选区 |
| Home / End | 播放头移到开头 / 结尾 |
| Cmd+Z / Shift+Cmd+Z | undo / redo |

### 9.3 渲染管线

- **整个 lanes 内容区只用一个 WebGL2 context**（Chrome 每页的 WebGL context 数量有上限，约 16 个）：一张覆盖 lanes 区域的 canvas，按每条可见 lane 的矩形设置 viewport / scissor 绘制；纵向滚动时重画。波形、overlay、选区、播放头用每条 lane 自己的 Canvas2D 叠在上面。
- 视口变化时：先用已有纹理按新视口做 UV 变换立刻重画（纹理之外画背景色），同时以 60 ms 防抖发新请求；连续交互时至少每 150 ms 发一次；发新请求前 abort 旧请求。请求范围为可见范围左右各加 25% 余量，宽度按比例增加。
- 频谱数据按 CSS 像素请求（不乘 devicePixelRatio）；波形 canvas 按 devicePixelRatio 绘制，保证线条清晰。
- 上传 R16F 纹理前设 `gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)`。
- 改 dB 范围 / colormap / 纹理过滤：只更新 uniform 或 LUT，不发请求。改 STFT 参数 / mode / yscale / 频率范围：发新请求。
- hover 读数从前端保存的纹理数据（Uint16Array 按 half float 解码）读取；这是 pool 之后的值，状态栏标 "≈"。
- Frequency Analysis 面板在 frame 模式下跟随 hover：mousemove 按 requestAnimationFrame 节流，每次 abort 上一个请求。

### 9.4 播放

- 一个 AudioContext。按 Space 时，对每条可听 lane（非 mute，且没有 solo 或自身 solo）请求 `/pcm`：`sr` = `ctx.sampleRate`；C > 2 时带 `channel`（只播当前所选通道）；按 offset 换算起始样本与起播时刻。先取前 20 s，之后按 20 s 分块预取，用 `start(when)` 首尾相接。每块 → AudioBufferSourceNode → lane GainNode（gain / mute / solo 实时生效）→ master GainNode → destination。所有 lane 的第一块以同一个 `when` 起播。
- 选区播放与循环：循环时各 lane 的 buffer 补零到选区长度，保证每圈对齐；选区长于 20 s 时按分块重复调度。
- 有 T-F 选框时只对该 lane 请求带 f_lo / f_hi、画框 view 的 STFT 参数（n_fft、win_length、window、window_param）与完整矩形 `selection_t0,selection_t1` 的 `/pcm`，其他 lane 不发声。每个分块（包括续读和循环）都原样携带完整矩形，每个分块的 `t1 − t0` 仍不超过 20 s。对于同一个 [0, 20) s 的首块，矩形止于 20 s 时该处是真正的 mask 边缘；矩形止于 40 s 时 20 s 是内部拼接处。两种情况均以整条源 lane 固定 hop 施加一次 §15 试听 mask、整条重采样一次后切片为参考，并按 §19 的误差检查。
- 播放头 = 起播位置 + (ctx.currentTime − when)，requestAnimationFrame 绘制；播放头离开可视范围时整页翻页。
- master 之后接一个 AnalyserNode。`window.__vsr_test`（只在 `--dev` 与测试构建中存在）暴露它的 RMS、播放头位置，以及每个 view 最近一次频谱响应，供 e2e 断言。

### 9.5 视觉规范

深色、高密度、数字用等宽字体。CSS 变量（覆盖 Mantine theme）：

```
--bg #17191c   --panel #202328   --panel-2 #272b31   --border #343941
--text #d7dbe0 --text-dim #8b929b --accent #4aa3ff
--wave #3ddc97 --wave-rms #9ff0cb --playhead #ffd166  --record #ff4d4f
--selection rgba(255,255,255,0.12)  --selection-border rgba(255,255,255,0.5)
```

基准字号 12 px，控件高度 24 px；数字用 `font-variant-numeric: tabular-nums`，字体 `ui-monospace, "JetBrains Mono", Menlo`。波形画法：max/min 填充 `--wave`，其内画 rms 带 `--wave-rms`。

colormap（256 色 LUT）：`heat`（UI 默认）、`magma`、`inferno`、`viridis`、`gray`、`gray_r`、`RdBu_r`（差值图）。magma / inferno / viridis 的数据可从 matplotlib 拷贝（CC0），RdBu 来自 ColorBrewer。UI 应用 preset 时不取其中的 `cmap`，保留用户当前的 colormap；`vsr.plot` 使用 preset 的 `cmap`（skill 规定对外的图用 magma）。

`heat` 控制点（位置 → sRGB，之间线性插值）：0.00 `#000000`、0.15 `#0b0b3b`、0.35 `#4b1f8f`、0.55 `#b0217f`、0.75 `#f25c1f`、0.90 `#ffd23f`、1.00 `#fffbe6`。

### 9.6 交互约定（照 Audition）

Human 的要求：UI 必须友好，交互可以直接照 Audition。

- Audition 已有的交互（工具与快捷键、选区与选框的拖动手柄、频谱框选后的试听与删除、transport 与播放头、面板停靠、时间与选区的数字输入）按 Audition 的方式做。实现者不确定某个细节时以 Audition 的行为为准，并在 §21 记一行。
- 只借鉴交互与布局，不使用 Adobe 的图标、logo、产品名或其他素材；图标用 `@tabler/icons-react`。
- 选区浮动工具条：时间选区或 T-F 选框建立后，在其上方显示小工具条：播放、删除、增益旋钮（拖动调 ±dB，松开后执行 `gain` / `spectral_attenuate`）、提取为新 lane。
- 选区数值可编辑：顶部条显示时间选区的 start / end / duration，有 T-F 选框时另显示 f_lo / f_hi，都可直接输入。
- 破坏性操作都可 undo，不弹确认框；只有保存覆盖原文件、关闭未保存的 lane 时确认。
- 每个按钮有 tooltip（名称 + 快捷键）；按 `?` 打开快捷键一览。右键菜单覆盖选区、lane header、空白区域三处，菜单项与快捷键一致。
- 超过 300 ms 的操作显示进度或 spinner，不冻结 UI；错误用 notification，不用 alert。

### 9.7 可见区域 PDF 导出

工具栏提供截图入口；进入后在当前可见的 Lanes 绘图区域或 Frequency Analysis 绘图区域内拖出矩形，释放即确认并下载 PDF，Esc 取消，零面积拖动取消。截图框是独立状态，不改变播放、播放头、时间选区或 T-F 选框。可选范围为拖动起点所在绘图区域中当前可见的图表内容及其坐标轴、标签、colorbar 或图例，受该绘图区域、视口和各可见祖先的裁剪共同限制；拖动超出范围时截到可见边界，不滚动或纳入屏外内容。

以确认时的可见物理像素为准，按画面层叠顺序组合当前绘制的波形、频谱、Frequency Analysis 的曲线、坐标轴、标签与所显示的图例、colorbar、选区、播放头及其他可见交互标注，并应用相同的滚动与容器裁剪；排除 dock 标签、面板控件、周围界面和截图手势框本身。WebGL 在其当前绘制缓冲仍可读取时复制到合成画布，再合成 Canvas2D 与可见文本 / 交互层，不发起 DSP 计算或数据请求，不使用屏幕捕获权限。以裁剪物理像素宽高作为栅格宽高，保持纵横比，不缩放或重排内容；单页 PDF 的页面尺寸以点为单位取同样数值，并以覆盖整页的单幅 JPEG 栅格编码。用浏览器原生画布、Blob 与下载能力生成 PDF，不增加后端路由、运行时依赖或用户音频写入。M2 的 mel 与 feature 图实现后复用同一导出路径。

## 10. Tensor 载入与推送

格式：`.pt / .pth`（torch.load，weights_only）、`.npy`、`.npz`、`.safetensors`（可选依赖）。

载入流程：读文件 → 遍历 dict / list / tuple，得到所有 tensor 叶子（如 `["mel"]`、`[0]["wav"]`）→ 返回 tree `[{key_path, shape, dtype}]`。前端弹出对话框：左边叶子列表，右边 interpretation 表单；只有一个叶子时只显示表单。

Interpretation：

- `kind=audio`：layout ∈ `[N]`、`[C,N]`、`[N,C]`、`[B,N]`、`[B,C,N]`；`sr` 必填（预填上次值，存 localStorage）。B 维每项一条 lane，上限 32，超出时提示。
- `kind=feature`：axes ∈ `[F,T]`、`[T,F]`、`[B,F,T]`、`[B,T,F]`；`sr` 与 `hop` 必填（frame_rate = sr/hop）；`freq_axis`（linear 需 f_max；mel 需 n_mels、fmin、fmax、htk；index 无参数）；`value_scale`（§8.5）。
- 预填启发式（只预填，不跳过对话框）：1D → audio；2D 且某维 ≤ 8 → audio `[C,N]`；2D 且某维 ∈ {80, 100, 128, 257, 513, 1025} → feature，该维为 F；complex → feature。
- dtype：整型音频按位深归一化（int16 除以 32768 等）；其余转 float32。

Python 客户端（`src/vsr/__init__.py`，只依赖 torch / numpy / 标准库 urllib）：

```python
import vsr

vsr.show(wav, sr=24000, name="pred")                       # audio；1D / 2D / 3D 按 layout 规则
vsr.show(mel, kind="feature", sr=24000, hop=256,
        freq_axis=dict(type="mel", n_mels=80, fmin=0, fmax=8000, htk=False),
        value_scale="ln_magnitude", name="mel_pred")
vsr.show({"gt": gt, "pred": pred}, sr=24000)               # dict → 多条 lane，名称取 key
```

- 先 `.detach().cpu().float().contiguous()`。layout 推断：1D → `[N]`；2D 且第 0 维 ≤ 8 → `[C,N]`；2D 且第 1 维 ≤ 8 → `[N,C]`；其他情况抛 ValueError，要求显式传 `layout=` 或 `kind="feature"`。dict 的每个条目单独 POST 一次（一个 frame 一个数组）。
- 连接前核对 runtime.json 中的 hostname 与本机一致（共享 home 的集群上避免推到别的节点的 server）；不一致时抛异常，提示改用 `VSR_URL`。
- server 未运行时抛出异常并给出启动命令，不自动启动 server。

## 11. 录音与多轨

- `GET /audio/devices` → sounddevice 设备列表（含 hostname、默认设备、最大输入 / 输出通道、默认采样率）。
- Record 面板：输入设备、输出设备（overdub 用）、采样率、blocksize、文件格式（`FLOAT` 默认 / `PCM_24` / `PCM_16`）、armed lane 与输入通道的映射（每条 armed lane 选 1 个通道或连续 2 个通道；"+ 新 lane" 为每个选中的输入通道建一条）、overdub 开关、延迟补偿（ms，默认取 `stream.latency` 的输入 + 输出；"Calibrate" 按钮要求一路物理 loopback，播放一个 click 并用互相关测出实际往返延迟）。
- arm 任一 lane 后，后端打开 InputStream 只计算电平，经 WS `record_meter` 推送各输入通道 peak / RMS dBFS 与 clip 标志，用于调增益。

`POST /record/start {input_device, output_device?, sr, blocksize, subtype, mapping, overdub, latency_ms, start_time}`：

- 不 overdub 用 InputStream；overdub 用同一个全双工 `sd.Stream`，输出为从 start_time 起其余可听 lane 的混音（采样率不同时用 `scipy.signal.resample_poly` 转到录音采样率）。输入与输出是不同物理设备时两者时钟不同步，长录音会漂移，UI 给出提示。
- PortAudio callback 里只做 `queue.put(indata.copy())`（overdub 时另外填 outdata）。独立 writer 线程从队列取块，写入每条 lane 各自的 `soundfile.SoundFile`（路径 `recordings_dir/YYYY-MM-DD/HHMMSS_<lane 名>.wav`），计算电平，并约每 100 ms 推送 `record_preview`，前端据此实时画出增长中的波形。
- callback 的 status（input overflow / output underflow）逐次记录时间与类型，录音结束后显示在 notification 与 lane Properties 中，不静默。
- 任何异常（设备断开等）都先关闭已打开的文件，保证已录部分可读。
- stream 的构造函数可注入，测试用假 stream 替换。

`POST /record/stop`：停流，取完队列，关闭文件，把文件载入为 lane（替换 armed lane 的内容或新建 lane）。lane offset = start_time；overdub 时丢弃开头 latency 对应的样本以对齐。

补充：

- `/record/start` 时先关闭电平用的 stream，再打开录音 stream；`/record/stop` 后重新打开电平 stream。`stream.latency` 在录音 stream 打开后读取，延迟补偿在 stop 时应用。
- 没有 armed lane 时按录音键：新建一条 mono lane，映射到默认输入设备的第 1 个通道。
- 录音开头 1 s 全为 0 时提示检查麦克风权限（macOS 拒绝权限时 CoreAudio 返回全 0 而不报错）。
- `sounddevice` 延迟 import（§4）。

混音（播放与 mixdown 共用规则）：可听 lane = 非 mute，且没有 solo 或自身 solo；`mix = Σ 10^(gain_db/20) · lane`，按 offset 放置，采样率统一到目标 sr。`POST /mixdown {t0, t1, sr, path, subtype}` 写文件；超过 0 dBFS 时只警告，不自动限幅。

## 12. Analyzer 插件

```python
# ~/.vsr/plugins/my_f0.py
import torch
from vsr.api import analyzer, Param, TimeCurve

@analyzer(id="f0.harvest", label="F0 (WORLD Harvest)", version=1, input="audio")
def harvest(x: torch.Tensor, sr: int, *,
            f0_floor: float = Param(71.0, min=40, max=400, unit="Hz"),
            f0_ceil: float = Param(800.0, min=200, max=1600, unit="Hz")) -> TimeCurve:
    ...
    return TimeCurve(times=t, values=f0, unit="Hz", overlay="freq", y_scale="log")
```

约定：

- `input="audio"`：x 为 float32 [C, N] CPU tensor（选区或整条 lane；UI 指定通道时为 [1, N]），sr 为 int。`input="feature"`：x 为 [F, T]，另收到 `frame_rate`、`freq_axis`、`value_scale` 关键字参数。
- `Param(default, min=None, max=None, step=None, choices=None, unit=None, label=None)`，类型为 float / int / bool / str（有 choices 时显示为下拉）。前端按 schema 自动生成表单。
- `vsr.api.compute_device()` 返回配置的设备，插件自行决定是否使用。
- 输出类型（`vsr.api` 中的 dataclass，tensor 与 ndarray 都接受）：

| 类型 | 字段 | 前端显示 |
|---|---|---|
| `TimeFreqImage` | values [F,T]、frame_rate、frame_t0、freq_axis、value_scale | 新 feature lane（parent = 源 lane） |
| `TimeCurve` | times [T]、values [T] 或 [K,T]、unit、overlay（"freq" 或 "lane"）、y_scale、labels | "freq"：画在源 lane 的频谱上（values 为 Hz）；"lane"：新 curve lane |
| `Events` | items: [(t0, t1, label)] | 新 events lane |
| `Spectrum` | freqs [F]、values [F] 或 [K,F]、unit、labels | 加入 Frequency Analysis 面板 |
| `Scalars` | dict[str, float] | Analyzers 面板的结果表；数据集扫描时成为列 |
| `Audio` | wav [C,N]、sr | 新 audio lane |

- 插件返回的时间是输入 x 内的时间；在选区上运行时由 registry 加上选区起点，换成源 lane 内时间。

registry：

- 启动时加载 `plugin_dirs` 下的 `*.py` 与内置的 `vsr.analyzers.builtin`。每次 `GET /analyzers` 与运行前检查文件 mtime，变化则重新 import 该模块并广播 `plugins_changed`。import 失败的模块在列表中显示错误，不影响其他插件。
- 运行在线程池中；异常返回 traceback，server 继续服务。结果按 (lane id, version, analyzer id, analyzer version, params, t0, t1, channel) 缓存在内存。

内置插件（v1）：

- `energy`：帧 RMS dBFS（20 ms 窗、10 ms hop），TimeCurve，overlay="lane"。
- `vad.energy`：活动帧 = 帧 RMS > max(帧 RMS) − 40 dB 且 > −70 dBFS；最短语音段与最短静音段可调；输出 Events。
- `f0`：装了 pyworld 时用 harvest，否则用 `librosa.pyin`；TimeCurve，overlay="freq"，无声帧为 NaN。
- `griffinlim`：input="feature"，适用于 value_scale ≠ raw 且 freq_axis 为 linear 或 mel 的 lane（mel 先用 melfb 的伪逆还原线性幅度）；参数 n_iter、n_fft、hop；输出 Audio。

M5 同时交付 `docs/plugins.md`：一页插件编写说明，含上面 F0 例子的完整可运行版本。

## 13. 数据集分析

来源：目录（递归匹配 wav / flac / ogg / mp3）或 manifest（CSV / TSV / JSONL，必须有 `path` 列，相对路径以 manifest 所在目录为基准；其他列原样保留为可筛选的元数据，如 speaker、text）。可同时载入多个来源，自动加 `source` 列，用于数据集之间的对比。

扫描（后台 job，`ThreadPoolExecutor`，workers = min(8, CPU 数)，固定在 CPU 上计算，进度经 WS `job_progress` 推送，可取消）：

- 每个文件：soundfile 读取 → 记录 sr、channels、subtype、duration → 多通道取均值得到 mono → 计算指标。读取失败的文件也保留为一行，`error` 列写原因，扫描继续。
- 内置指标：`duration_s`、`sr`、`channels`、`subtype`、`peak_dbfs`、`rms_dbfs`、`clip_ratio`（|x| ≥ 0.999 的样本比例）、`dc_offset`、`lead_silence_s`、`trail_silence_s`、`active_ratio`（§8.6）、`bandwidth_hz`，以及不进表格的 `ltas` 向量。
- `bandwidth_hz`：对活动帧按 preset `ltas`（§16）做 Welch，得 LTAS_dB(f)；ref = 300–3000 Hz 内 LTAS_dB 的中位数；bandwidth = 满足 LTAS_dB(f) ≥ ref − 50 dB 的最高 bin 频率（阈值可调）。用途：找出从低采样率上采样来的文件。
- `ltas`：上述 Welch 结果按 `unit=db_per_hz` 映射到固定网格（20 Hz–24 kHz，1/24 倍频程，约 245 点）：每个网格点取其 1/24 倍频程带内各 bin 的功率平均，带内没有 bin 时在相邻 bin 间线性插值；高于该文件 Nyquist 的点为 NaN；以 f16 存储。用 dB/Hz 是为了让不同采样率、不同窗长的文件可以直接比较。
- 用户可勾选 Scalars 类型的 analyzer 作为额外列。

缓存：`$VSR_HOME/cache/datasets.sqlite`，键 (绝对路径, size, mtime_ns, 内置指标版本号, analyzer id, analyzer version, params hash)。未变化的文件再次扫描时不重新计算。不往数据集目录写任何文件。

视图（中央 tab）：

- 上：AG Grid 表，全部列可排序、可过滤（数值列支持范围过滤），显示总行数与过滤后行数。双击行在 Lanes 视图打开该文件。
- 下：分组选择（任一元数据列，默认 `source`）+ 三种图，都只用过滤后的行：直方图（选一列）、散点（选两列，超过 2 万点时随机抽样并标注）、LTAS（每组 mean 实线 + p10–p90 带；mean 在功率域平均，分位在 dB 域，忽略 NaN）。
- 导出过滤结果为 CSV。

接口：`POST /datasets {sources}` → id 并开始扫描；`GET /datasets/{id}/rows` → 列式 JSON `{columns, data: {col: [...]}}`；`POST /datasets/{id}/ltas {groups: {name: [row_idx, ...]}}` → framed；`POST /datasets/{id}/cancel`。`# shortcut: rows 一次性返回，适合 20 万个文件以内；更大时改为分页。`

## 14. RIR

### 14.1 分析：`POST /rir/analyze {lane, channel, bands, use_lundeby, truncation_s?}`

- onset：只在 broadband h 上检测一次：|h|² 第一次达到 max(|h|²) − 20 dB 的样本（ISO 3382-1 的起点定义）。
- 频带：broadband，加上倍频程 125、250、500、1k、2k、4k、8k Hz 中上边沿 f·√2 < 0.95·Nyquist 的频带。滤波器：`scipy.signal.butter(3, [f/√2, f·√2], btype="bandpass", fs=sr, output="sos")`。
- 能量比（C50、C80、D50、DRR）：先在 broadband h 上按时间切段，再对每段分别正向 `sosfilt` 后求总能量（先加时间窗再滤波，避免滤波器把直达声能量移出窗口）。C50 / C80 = 10·log10(E_early / E_late)，early = [onset, onset + 50 / 80 ms)，late = [onset + 50 / 80 ms, t_c)，late 加截断补偿项；D50 = E[onset, onset + 50 ms) / E[onset, t_c)（比值，不是 dB）。DRR：direct = broadband 峰值 ±2.5 ms（窗起点早于 0 时截到 0），rest = 其余到 t_c 的部分；broadband 与各频带都给出。
- 衰减（EDC、EDT、T20、T30）：频带信号用时间反转滤波得到（对反转的 h 做 `sosfilt` 再反转回来），减小滤波器自身衰减对短混响的影响；EDC 的起点取该频带信号上按同一规则重新检测的 onset。
- 噪声截断：默认用 Lundeby 迭代法（Lundeby et al., Acustica 81, 1995）求噪声底与交点 t_c，并对 t_c 之后的能量做补偿。参数：初始平滑窗 30 ms；每 10 dB 衰减 5 个区间；噪声底初值取信号末 10%；最多迭代 5 次。找不到噪声底（例如无噪声的合成信号）时 t_c 取信号末尾、不加补偿。`noise_floor_db` 以平滑后 |h|² 的峰值为 0 dB。`use_lundeby=false` 时 t_c 为信号末尾、不补偿。也可在图上拖动截断点（`truncation_s`）。
- EDC：Schroeder 反向积分 `EDC(t) = ∫_t^{t_c} h²(τ) dτ`（加补偿项），归一化到 0 dB。
- 衰减时间：在 EDC(dB) 上做最小二乘直线拟合，T = −60 / slope。EDT 用 0 至 −10 dB，T20 用 −5 至 −25 dB，T30 用 −5 至 −35 dB。拟合下限低于噪声底 + 5 dB 时该项返回 null 并给出原因。每个拟合同时返回 r²。
- 返回 JSON：每个频带 {T20, T30, EDT, C50, C80, D50, DRR, r2, noise_floor_db, crosspoint_s}；broadband 另含 onset_s、PNR（峰值与噪声底之比）；曲线（dB 包络、EDC、拟合线）降采样到 ≤ 4000 点。
- RIR 面板：上图为 dB 包络（淡色）+ EDC（粗线）+ 拟合线 + 截断点竖线（可拖）；中图为各频带 EDC 叠加；下方为结果表。
- RIR 面板另显示所选 audio lane 与通道的脉冲响应系数。纵轴为原始样本 `h[n]` 的有符号线性振幅，画出零线。横轴为 lane 内延迟 `τ = 1000·n/sr`（ms），沿用 §14.2 的时间零点和未标定提示。宽视口画每列的最小值与最大值，按工作台的时间缩放交互放大后可查看原始样本。图与 dB 包络、EDC、拟合线和结果表共用当前 lane 与通道。
- 用现有 broadband `onset_s` 对应的样本作为初始直达参考。选择「设为直达参考」后单击图中的样本可移动参考，普通单击可标记参考之后的到达。点击时间取最近的原始样本。各标记显示 `τ` 和该样本的有符号振幅，后续到达另显示 `Δτ = 1000·(n_arrival − n_direct)/sr`（ms）。移动参考时保留新参考之后的标记并更新延迟差。标记仅用于读数，原有分析起点、截断点、C50、T20 等结果按本节计算。
- 系数图复用 §7 的 `/lanes/{id}/waveform` 和 §6 的帧格式。请求带所选通道并将可见时间加上 lane offset 转为 session 时间。总览用已有 min/max，原始样本视图按 `first_sample` 定位。若标记样本尚未在当前帧中，按其样本区间读取同一路由的单样本帧。直达参考用工作台强调色，后续到达用带文字的独立标记。

### 14.2 测量（ESS）：`POST /rir/measure`

参数：f1（默认 20 Hz）、f2（默认 min(20 kHz, 0.95·Nyquist)）、时长 T（默认 5 s）、幅度（默认 −12 dBFS）、淡入 50 ms / 淡出 10 ms、前置静音 0.5 s、尾部静音（默认 3 s，应长于预期混响时间）、重复次数 N（时间域平均）、输出通道、输入通道（多个 → 多通道 RIR）、loopback 输入通道（可选）、IR 保留长度。

- 扫频：`x(t) = A · sin(2π · f1 · T / ln(f2/f1) · (exp(t · ln(f2/f1) / T) − 1))`。
- 用 `sd.playrec` 全双工录制；原始录音同时写入 `recordings_dir/rir/<时间戳>/raw_*.wav`。结束后检查 `sd.get_status()`，有 overflow / underflow 时本次测量标为无效，提示重测。
- 反卷积：FFT 长度 = 录音全长，X 为整段播放信号（含前后静音）。频域正则化除法 `H = Y · conj(X) / (|X|² + ε(f))`，ε(f) 在 [f1, f2] 内为 1e-6 · max|X|²，带外为 1e2 · max|X|²。IFFT 后取 [0, IR 长度)，落在负时间段的谐波失真成分被丢弃。
- 有 loopback 时，对 loopback 通道做同样的反卷积，取其峰值位置 d，各通道 IR 左移 d 个样本，使时间零点为电信号输出时刻。无 loopback 时不移位，元数据中注明时间零点未标定。
- 输出：新 audio lane（多通道），并保存 `rir.wav`（FLOAT）与 `rir.json`（全部参数、设备名、sr、时间戳、是否有 loopback）。
- 安全：幅度 > −6 dBFS 时 UI 要求二次确认。"Preview" 按钮以 −30 dBFS 播放 1 s 扫频，用于确认接线（`/rir/sweep_preview`）。

## 15. 编辑

作用于 audio lane 的选区（无选区时作用于整条；cut / delete / trim 必须有选区）：

- `POST /lanes/{id}/edit {op, t0, t1, channel?, params}`，op ∈ `delete`、`cut`、`copy`、`paste`（插入到播放头处，剪贴板在后端）、`silence`、`insert_silence`、`trim`（只保留选区）、`gain`（dB）、`normalize`（峰值到目标 dBFS）、`fade_in` / `fade_out`（linear / equal-power）、`invert`、`mixdown_channels`（转 mono）、`spectral_attenuate`、`spectral_extract`。
- `spectral_attenuate {t0, t1, f_lo, f_hi, gain_db, n_fft, win_length, window, window_param}`（STFT 参数由前端从画框所在的 view 传入）：STFT 用这些参数，hop = win_length // 4（满足 ISTFT 的窗重叠条件）；T-F 矩形内乘以 10^(gain_db/20)（gain_db = −inf 即置 0），矩形边缘在时间方向用 2 帧、频率方向用 2 个 bin 的余弦过渡；ISTFT；只替换 [t0 − n_fft/sr, t1 + n_fft/sr] 内的样本，两端各用 n_fft 个样本与原信号交叉淡化。
- T-F 框的试听、`spectral_extract {t0, t1, f_lo, f_hi, n_fft, win_length, window, window_param}`（框内声音提取为新 audio lane，offset 与源对齐，不修改源 lane）与 `spectral_attenuate` 共用同一个 mask 函数。T-F 选框上按 Delete = `spectral_attenuate` 且 gain_db = −inf（框内 mask 为 0，边缘保留余弦过渡）。
- 每次编辑（`copy` 除外）：压入 undo snapshot → 修改 → version + 1 → dirty = True → 其派生 lane 置 stale → 广播 `lanes_changed`。`POST /lanes/{id}/undo`、`POST /lanes/{id}/redo`。
- 保存：`POST /lanes/{id}/save {path?, subtype}`，格式由扩展名决定，只支持 wav / flac。path 为空表示写回 source 路径，只在 source 是 wav / flac 文件、且该 lane 是这个文件对应的唯一 lane 时允许（前端先确认）；其他情况（tensor 文件、mp3 / ogg、push / upload / record 来源、一个文件拆出的多条 lane）返回 400，前端转为 Save As。原子写入（§4）。dirty 的 lane 名称前显示 `•`，关闭前确认。

## 16. 配套 skill 与公共 Python API

vsr 随包发布一个 speech visualization 标准 skill：`src/vsr/skills/vsr-speech-visualization/`（`SKILL.md` + `presets.toml`）。skill 是标准，vsr 是它的实现：

- `presets.toml` 是 preset 的唯一定义。后端、Display 面板的 preset 下拉、`vsr.plot` 都通过 `importlib.resources` 读这个文件；前端经 `GET /api/presets?sr=` 取得换算后的参数。
- skill 的规则与 preset 数值由 Human 决定；实现与 skill 不一致时改实现。
- `vsr skill install [--claude] [--codex]`：把该目录 symlink 到 `~/.claude/skills/` 和 / 或 `~/.agents/skills/`（Codex 读取 user 级 skill 的目录）。目标已存在且不是指向这里的 symlink 时报错，不覆盖。

Preset 换算（sr 单位 Hz）：

- `win = 2^round(log2(win_ms·sr/1000))`（`pow2_win = true`）或 `round(win_ms·sr/1000)`
- `hop = round(hop_ms·sr/1000)`（给了 `hop_ms` 时）或 `round(win·hop_ratio)`
- `n_fft = 2^ceil(log2(win·nfft_factor))`
- 舍入一律为 `floor(x + 0.5)`（44.1 kHz 下 220.5 → 221）；上面的 round 即指此定义。
- `f_max_hz = 0` 表示 Nyquist；大于 Nyquist 时取 Nyquist
- `db = "auto80"`：ceil = 参与显示的数据（对比时取所有面板）的最大 dB 向上取整到 10 dB，floor = ceil − 80；也可写成 `[lo, hi]`

Spec line：用一行文字完整描述一张图的分析参数。Display 面板的 "Copy spec" 输出它；`vsr.plot` 返回它，并写进 PNG 的文本元数据（key `vsr-spec`）。

```
vsr-spec v1 | preset=narrowband | sr=24000 | window=hann | win=768 | hop=120 | n_fft=2048 | y=linear 0-5000Hz | db=[-80,0] dBFS | cmap=magma
vsr-spec v1 | feature | sr=22050 | hop=256 | y=mel(80, 0-8000Hz, slaney) | value=ln_magnitude | range=[-11.5,2.0] | cmap=magma
```

格式：`vsr-spec v1 | <对象> | key=value | ...`。对象为 `preset=<name>`（频谱图）、`feature`、`spectrum`、`rir` 之一。键按下列顺序出现，没有的省略：`sr`、`mode`（`mel(<n_mels>, <fmin>-<fmax>Hz, htk|slaney)`，stft 时省略）、`window`（带参数时写成 `kaiser(8.6)`、`gaussian(0.125)`）、`win`、`hop`、`n_fft`、`y`（`linear|log <lo>-<hi>Hz`，或 feature 的 `mel(...)` / `index`）、`value`（feature 的 value_scale）、`stats`（spectrum 的统计量）、`db=[lo,hi] <单位>`（单位为 `dBFS`、`dB/Hz` 或 `dB`；raw feature 用 `range=[lo,hi]`）、`cmap`、`overrides`（相对 preset 改过的键名，逗号分隔）。

公共 Python API（skill 依赖这些签名，实现不得改名）：

```python
vsr.show(...)                                                     # §10
vsr.resolve_preset(name: str, sr: int, **overrides) -> dict       # 换算后的全部参数
vsr.spec_line(params: dict) -> str

vsr.dsp.stft_db(x, sr, **params) -> tuple[Tensor, Tensor, Tensor]          # db [C,F,T]、帧中心时间、频率
vsr.dsp.mel_db(x, sr, **params) -> tuple[Tensor, Tensor, Tensor]           # db [C,M,T]、时间、mel 通道中心频率
vsr.dsp.welch(x, sr, stats=("mean",), unit="dbfs", **params) -> tuple[Tensor, Tensor]   # [C,S,F]、频率
vsr.dsp.rir_metrics(h, sr, bands=None, use_lundeby=True) -> dict           # 与 §14.1 的返回结构相同

vsr.plot.spectrogram(ax, x, sr, preset="analysis", db=None, f0=None, **overrides) -> str   # f0=(times, hz) 叠加曲线；返回 spec line
vsr.plot.compare(signals: dict, sr, preset="analysis", waveform=False, db=None, diff=None) -> tuple[Figure, str]   # diff=("GT", "Proposed")：追加 RdBu_r 差值面板（要求逐样本对齐）
vsr.plot.spectrum(ax, signals: dict, sr, preset="ltas", stats=("mean", "p10", "p90")) -> str
vsr.plot.rir(ax, h, sr, bands=None) -> dict
vsr.plot.savefig(fig, path, **kw) -> None      # 把 fig 上记录的 spec line 写入 PNG 文本元数据 vsr-spec（PDF 写入 Keywords）
```

- `vsr.dsp` 与 server 是同一份实现，不另写。输入接受 torch.Tensor 或 numpy（[N] 或 [C,N]），在 `compute_device` 上计算，返回 CPU tensor。
- `vsr.plot` 依赖 matplotlib（extra `plot`），colormap、坐标轴与 colorbar 标注遵循 skill 的规则。`compare` 对所有面板使用同一 preset 与同一 dB 范围，并共享时间轴。各函数把 spec line 记在 `ax.figure` 上（多个时换行连接），由 `vsr.plot.savefig` 写入文件；普通的 `fig.savefig` 不带元数据。
- `vsr scan SOURCE... -o metrics.csv [--ltas ltas.npz] [--group-by COL]`：无 UI 的数据集扫描，与 §13 同一代码与缓存，供 agent 在终端里检查数据集。

## 17. 性能参考值（按平台记录，不作通过条件）

下表是 M 系列 Mac 的参考值，`compute_device` 为 cpu 与 mps 时各测一次。参考值用来发现回退、定位瓶颈，不是通过条件：在任何平台上没有达到它，验收都不因此失败，也不通过删减功能来接近它。

| 操作 | 参考值（M 系列 Mac） |
|---|---|
| 打开 10 分钟 48 kHz 立体声 WAV 到首次画出波形 | < 1 s |
| 同一文件首次画出频谱（n_fft 2048，hop 512） | < 1.5 s |
| STFT 已缓存时，平移 / 缩放的请求往返 | < 80 ms |
| 改 dB 范围 / colormap | 下一帧生效，无网络请求 |
| 60 s 48 kHz 单声道改 n_fft 后重画 | < 300 ms |
| 平移 / 缩放期间重画帧率 | ≥ 50 fps |
| `vsr.show()` 到 lane 出现 | < 1 s |

其他平台（例如 Raspberry Pi 5 的 cpu、带 cuda 的机器）的参考值不在本节：该平台首次测量后，由 run 把实测值记入 `docs/dev/performance.md`；之后在该平台上的每次测量，与同平台、同设备的上一次数值比较，回退写进验收报告（`LIFECYCLE.md` 的 Performance budget）。

第 1 行在 M0、第 2–6 行在 M1、第 7 行在 M2 测量并记录，用 `tests/bench/` 下的脚本在 run 所在平台的每个可用 `compute_device` 上实测。与参考值或上一次数值相差较大时，报告实测值与瓶颈。

## 18. 仓库结构与依赖

```
visualized-speech-research/
  AGENTS.md
  pyproject.toml              # hatchling；入口 vsr = vsr.cli:main
  docs/  DESIGN.md  plugins.md  manual-checks.md
  src/vsr/
    __init__.py               # show()、resolve_preset()、spec_line()
    api.py                    # 插件 API：analyzer、Param、输出类型、compute_device
    cli.py  config.py  frame.py  device.py  presets.py  plot.py
    server/   app.py  routes_*.py  session.py  ws.py
    dsp/      __init__.py（公共 API，§16）  stft.py  spectrum.py  mel.py  waveform.py  rir.py  sweep.py  edit.py
    io/       audio.py  tensors.py
    record/   devices.py  recorder.py  mix.py
    analyzers/  registry.py  builtin/
    dataset/  scan.py  store.py
    skills/vsr-speech-visualization/   SKILL.md  presets.toml   # 配套 skill（§16），随包发布
    web/                      # npm run build 的输出（gitignore；打包时包含）
  frontend/
    package.json  vite.config.ts   # dev 时把 /api 与 /ws 代理到 8765
    src/  api/  state/  lanes/  render/  panels/  audio/
    tests/                    # vitest 单元测试 + Playwright e2e
  tests/                      # pytest；tests/bench/ 为性能脚本（不进常规测试）
```

依赖：

- Python ≥ 3.11（需要标准库 `tomllib`）：torch、numpy、scipy、soundfile、sounddevice、librosa、fastapi、uvicorn[standard]。可选 extras：`world`（pyworld）、`safetensors`、`plot`（matplotlib）。dev：pytest、ruff、httpx。打包：`[tool.hatch.build] artifacts = ["src/vsr/web/**"]`（`web/` 被 gitignore，hatchling 默认不打包它）。
- 前端：react、react-dom、@tabler/icons-react、@mantine/core、@mantine/hooks、@mantine/notifications、dockview、uplot、ag-grid-community、ag-grid-react、zustand。dev：typescript、vite、vitest、@playwright/test。

## 19. Milestones 与验收

每个 milestone 结束时：全部已有测试通过；验收清单逐条报告结果；e2e 截图存到 `frontend/test-results/screens/M<k>-*.png` 供 Human 查看。

**M0 骨架**：CLI 与 token、FastAPI、framed 编解码、文件浏览 / 打开 / 拖放上传、Lanes 视图的标尺 + overview + 波形、时间缩放与平移、选区、Web Audio 播放与播放头、dockview 布局与深色主题、计算设备选择与 self-check（§4）。

- [ ] `vsr sample.wav` 打开浏览器并显示波形；不带 token 请求 `/api/session` 返回 401
- [ ] 缩放到样本级时显示样本点；10 分钟立体声文件按 §17 第 1 行测量并记录
- [ ] e2e（经 `window.__vsr_test`）：Space 播放 / 停止；选区播放结束时播放头停在选区终点；两条 lane 分别放同一信号 x 与 −x，循环两圈后 master RMS 仍低于单条 lane 的 RMS 60 dB 以上（证明各 lane 对齐）；mute 后 master RMS 下降 ≥ 40 dB；solo 时只有该 lane 发声
- [ ] 测试与 e2e 使用临时 `VSR_HOME` 与随机端口，不读写真实的 `~/.vsr`
- [ ] framed 编解码的 Python ↔ TS 往返测试
- [ ] `--device` 与 Settings 面板可切换设备；self-check 失败时回退 cpu 并提示（测试中 monkeypatch 使 self-check 失败）

**M1 频谱与频率分析**：§8.1–8.4、WebGL renderer、colormap、Display 面板、频率缩放、hover 读数、Frequency Analysis 面板（frame / welch、统计量、多 lane 叠加、线性 / log 频率轴）；preset 加载（§16）、Display 的 preset 下拉与 Copy spec、`vsr.dsp.stft_db` / `vsr.dsp.welch`；T-F 选框（E 工具）、框内试听、框的频率分析、选区浮动工具条（播放项）与右键菜单框架；§15 的 mask 函数（不含 edit op）、§8.6 活动帧、§8.4 的 full 方法、多 view；`GET /presets`。

- [ ] 测试：sr = 16000、n_fft = 512、f = 32·sr/n_fft = 1000 Hz、幅度 1 的正弦，只取不含 padding 的内部帧，读数为 0 ± 0.05 dBFS（hann、blackmanharris、kaiser β = 8.6 各一）
- [ ] 测试：按 §8.4 的 scipy 参数、排除 k = 0 与 k = n_fft/2：welch mean（dbfs）= scipy spectrum 的 dB + 3.01 dB；db_per_hz = scipy density 的 dB；误差均 < 0.05 dB
- [ ] 测试：§8.3 的列网格（p 为 2 的幂、对齐绝对帧号、平移整数列宽后像素不变）、log 行的带边界与插值、header 中 `row_freqs` / `col_t0` / `col_dt` 与数据一致
- [ ] 测试：`resolve_preset` 在 16 / 22.05 / 24 / 44.1 / 48 kHz 下的换算与 §16 规则一致；`spec_line` 输出与 §16 示例格式一致
- [ ] DSP 数值测试在本机所有可用设备上参数化运行并通过
- [ ] 测试（preset analysis / wideband / narrowband 各一）：500 Hz 与 3 kHz 两个正弦，选框 2–4 kHz：框内试听信号中 3 kHz 成分变化 < 1 dB，500 Hz 成分衰减 ≥ 40 dB
- [ ] e2e：E 工具框选后按 Space，发出带 f_lo / f_hi 的 `/pcm` 请求
- [ ] e2e（一条 mono lane、一个 view，n_fft 用下拉选择）：拖动 dB 范围不产生网络请求；改 n_fft 恰好产生一个频谱请求
- [ ] e2e：Add view 后同一条 lane 出现第二行 view，两行的 n_fft 可分别设置
- [ ] 测试：10 min、48 kHz mono、preset wideband 的整条计算，在独立子进程中测得峰值 RSS < 1.5 GiB；全视图请求按 §17 测量并记录
- [ ] 测试：同一缓存键的两个并发请求只计算一次
- [ ] 测试：`/pcm` 带 `sr` 时，相邻两个 20 s 分块拼接后与对整条 lane 调用 `scipy.signal.resample_poly` 的结果逐样本一致（误差 < 1e-6）；带 T-F mask 时同样检查拼接处
- [ ] e2e：真实 Chromium 中框选可见工作区并下载单页栅格 PDF；按 §20 检查裁剪与页面尺寸、频谱、波形和可见标注的对应像素、排除的界面与手势、音频选区不变及导出触发的数据请求数为零，并用独立 PDF 阅读器打开生成文件。

**M2 Tensor、推送、feature lane、mel、静态图**：§8.5、§10、mel 模式、`vsr.dsp.mel_db`、`vsr.plot`（spectrogram / compare / spectrum）、`vsr skill install`。

- [ ] 测试：`vsr.dsp.mel_db` 的 f32 输出换回功率后，与 `librosa.feature.melspectrogram(center=True, pad_mode="constant", power=2.0, window="hann")` × (2/Σw)² 相比，相对误差 < 1e-4（只比较功率大于最大值 × 1e-6 的元素）
- [ ] 测试：每种 layout / axes / value_scale 的载入；`weights_only` 拒绝含任意 Python 对象的 .pt
- [ ] 另一个 Python 进程调用 `vsr.show()` 后 lane 出现，耗时按 §17 第 7 行测量并记录；dict 推送生成多条 lane
- [ ] `vsr.plot.compare` 的所有面板 dB 范围相同、时间轴共享；经 `vsr.plot.savefig` 保存的 PNG 含 `vsr-spec` 文本元数据；`diff=` 生成以 0 为中心的对称范围差值面板
- [ ] 测试：`import vsr` 后 `sys.modules` 中没有 fastapi、sounddevice、librosa、matplotlib，访问 `vsr.plot` 后才出现 matplotlib；runtime.json 的 hostname 与本机不同时 `vsr.show` 报错
- [ ] `vsr skill install --claude --codex` 建立 symlink；目标已存在且不是指向本目录的 symlink 时报错，不覆盖

**M3 编辑**：§15，含 T-F 选框的删除、增益旋钮、提取为新 lane。

- [ ] 每个 op 有单元测试；undo 后 tensor 与编辑前逐位相同
- [ ] e2e：T-F 框选 → Delete → `/spectrogram` 返回的框内均值下降 ≥ 30 dB；Cmd+Z 后恢复到删除前 ± 0.5 dB
- [ ] 测试：source 为 .pt、mp3 或一个文件拆出的多条 lane 时，不带 path 的 save 返回 400
- [ ] spectral_attenuate（gain_db = −20；preset analysis / wideband / narrowband 各一）：矩形内的正弦衰减 19–21 dB；距框边 ≥ 8 个 bin 的框外正弦变化 < 0.5 dB
- [ ] 保存往返：PCM_24 / FLOAT 写入后读回在量化误差内一致；写入中途失败时原文件不受影响

**M4 录音与多轨**：§11。

- [ ] 测试：用注入的假 stream 按 blocksize 喂入已知信号（其中一次带 overflow 状态），录得文件与输入逐样本一致，overflow 被记录
- [ ] 测试：录音中途抛异常后，已写文件可被 soundfile 正常读取
- [ ] 测试：mixdown 的 offset / gain / mute / solo
- [ ] 测试：monkeypatch 使 `import sounddevice` 失败时 server 正常启动，`/audio/devices` 返回空列表与原因
- [ ] 测试：假 stream 输入全 0 时，录音 1 s 后发出麦克风权限提示事件
- [ ] 编写 `docs/manual-checks.md` 供 Human 手动检查：内置麦克风单轨录音；多通道声卡同时录 2 路以上；overdub 并用 Calibrate 测延迟

**M5 Analyzer 插件**：§12 与 `docs/plugins.md`。

- [ ] 示例插件文件放进插件目录后，不重启即出现在列表中；修改文件后再次运行即使用新代码
- [ ] 插件抛异常时 UI 显示 traceback，server 继续服务
- [ ] 六种输出类型各有一个测试插件；e2e 断言对应的 lane 或面板条目出现，曲线条数与数据点数与插件返回值一致
- [ ] e2e：运行 f0 后源 lane 的 overlay 数加 1、曲线点数等于插件返回的帧数；griffinlim 生成新的 audio lane（`/session` 中 kind = audio，时长与 feature 一致 ± 1 帧）

**M6 数据集分析**：§13 与 `vsr scan`（§16）。

- [ ] 测试 fixture 由代码生成：约 200 个短文件，含不同 sr、一个损坏文件、一个削波文件、一个 8 kHz 带宽上采样到 48 kHz 的文件
- [ ] bandwidth_hz：用 FFT 置零构造的 8 kHz 带限噪声（48 kHz）误差 ≤ 8 个 bin；`resample_poly` 16 → 48 kHz 的 fixture 只断言 < 10 kHz；clip_ratio 与静音时长和构造值一致
- [ ] 第二次扫描未变化的文件时不重新计算（以计数断言）
- [ ] 按 `source` 分组的 LTAS：一组为 48 kHz 白噪声，另一组为同一噪声经 `resample_poly(x, 1, 3)` 得到的 16 kHz 版本，每组总时长 ≥ 20 s，两组在 100 Hz–7 kHz 的 dB/Hz 差 < 0.5 dB；e2e 断言 LTAS 图的曲线条数等于组数
- [ ] `vsr scan` 输出的 CSV 与 UI 扫描结果一致，并共用缓存

**M7 RIR**：§14、`vsr.dsp.rir_metrics`、`vsr.plot.rir`。

- [ ] 测试（broadband）：h(t) = n1(t)·exp(−6.91 t / T60) + 10^(−50/20)·n2(t)，n1、n2 为独立标准高斯噪声（固定 seed），长度 2·T60 + 1 s，T60 ∈ {0.3, 0.8, 1.5} s，sr ∈ {16000, 48000}；开启 Lundeby 时 T30 相对误差 < 5%
- [ ] 测试：h[n] = exp(−6.91·n / (sr·T60))（无噪声，`use_lundeby=False`）：C50 与解析值相差 < 0.2 dB，D50 绝对误差 < 0.01
- [ ] 测试：sr = 48000；已知 IR 的直达声前有 ≥ 5 ms 延迟；与扫频卷积后加相对扫频 RMS −80 dB 的噪声，再反卷积；两者都经 `butter(8, [100, 10000], "bandpass", fs=sr, output="sos")` + `sosfiltfilt` 后比较，归一化误差 < −40 dB；loopback 延迟补偿精确到 ±1 样本
- [ ] 测试：假 `playrec` 的 status 含 overflow 时，测量标为无效
- [ ] `docs/manual-checks.md` 增加一项：真实扬声器 + 麦克风测量一次

## 20. 测试约定

- pytest：DSP 数值测试一律用代码生成的合成信号，不提交二进制音频或 tensor 文件。
- 前端：vitest 覆盖视口数学（时间 ↔ 像素、频率刻度映射）与 framed 解码；Playwright 使用其自带的 Chromium（`npx playwright install chromium` 取得，不设 `channel`），启动真实后端，覆盖各 milestone 的 e2e 项。平台没有可用的 Playwright Chromium 时，环境变量 `VSR_E2E_CHROMIUM` 给出该平台的 Chromium 可执行文件，`playwright.config.ts` 把它传给 `launchOptions.executablePath`；取值由 host contract 指定（见 `LIFECYCLE.md`），不写进仓库。
- 测试一律设置临时 `VSR_HOME` 与随机端口；随机数固定 seed。
- 平台差异：需要 mps、cuda 或录音 / 播放设备的 pytest，在运行平台上没有该设备时，用 `@pytest.mark.skipif(<没有该设备的条件>, reason="<原因>")` 跳过；e2e 不用条件 skip，依赖设备的检查放进 pytest（AGENTS.md「常见的写法，与规则下应该怎样写」一节）。真机录音与测量不进自动测试，见 `docs/manual-checks.md`。
- PDF e2e：固定视口、设备像素比与滚动位置，等待渲染稳定并暂停播放，在截图手势之前独立取得 Chromium 的 viewport PNG 截图和 DOM 的绘图区域及其可见祖先裁剪矩形；分别测试 Lanes 和 Frequency Analysis 的裁剪，fixture 包含非整数 CSS 坐标、DPR 1.5 和部分滚出视口的内容。以远离设备像素舍入临界点的未对齐 CSS 坐标驱动拖动，至少一条边超出可见裁剪；从独立观察到的 pointerdown / pointerup 实际 client 坐标和测得的裁剪几何求交，直接计算一次半开物理像素边界：左上乘 DPR 后向内取 ceil，右下乘 DPR 后向内取 floor，不以预先舍入的裁剪边界驱动手势，也不读取导出实现的截图框或合成画布。特别覆盖 DPR 1.5 下原定 x = 100 / 1.5 而实际 pointerup.clientX = 66.66666412353516 时右边界为 floor(x × 1.5) = 99 的精度案例；不得假定其为 100。裁剪尺寸必须为正，PNG 对应区域、PDF 栅格与页面宽高均相同，页面为一页。
- 自动像素路径只使用现有 Playwright / Node 与 Chromium：从下载 PDF 的交叉引用和对象长度读取唯一页面、MediaBox 和唯一 `DCTDecode` 图像流，验证图像宽高和覆盖页面的变换；在浏览器中以 `createImageBitmap` 解码该 JPEG 与独立 PNG，再用 Canvas2D `getImageData` 读取像素。选取空间分离、稳定且高对比的频谱、波形、可见标注及 Frequency Analysis 曲线、坐标轴、标签和所显示图例的内部区域，按相同裁剪相对坐标逐通道比较，JPEG 与 PNG 的 RGB 绝对差各 ≤ 20；区域远离抗锯齿边界并覆盖多个像素。在原始拖动矩形内、合格绘图边界之外放置醒目的 chrome 标记，验证裁剪后不包含该标记；另验证截图手势颜色未进入输出。同时断言原时间与 T-F 选区不变、导出动作没有触发数据请求。独立阅读器 smoke 将保存的 PDF 用启用内置 PDF viewer 的完整 Chromium 打开，确认单页可见且方向、内容正确并记录结果；该完整浏览器单独指定，不假定标准无 channel 或 executable 覆盖的 Playwright 无头启动器是完整 Chromium。此检查不以截图目视判断代替自动像素断言。
- e2e 中只能靠肉眼判断的项（截图）不作为验收门槛，只供 Human 查看。
- 检查命令见 AGENTS.md。

## 21. 实现中的补充决定

（实现者在此追加，每条一行：`D<n>`、日期、决定、理由。`D<n>` 与 `docs/dev/decisions.md` 共用一个编号序列，完整的依据与回退写在该文件。）

D33（2026-11-17）：性能参考值按平台记录且不作为通过条件；其他平台首次实测建立本平台参考，以便发现后续回退。
D36（2026-11-17）：framed 消息的 payload 起点从消息首字节按 8 字节对齐，多数组 offset 从 payload 起点计并按 8 字节对齐，以保证跨语言一致。
D37（2026-11-17）：设备自检使用相同非零输入，逐项计算候选结果与 CPU 参考的二范数相对误差，并要求每项严格小于 1e-4。

D40（2026-11-18）：按 H45 将可见工作区矩形裁剪的单页栅格 PDF 导出纳入 M1；复用已渲染图层并独立保存截图选区，以保留所见内容和现有音频交互。
D43（2026-11-18）：masked PCM 将完整 T-F 矩形与分块边界分开传递；同一首块的 20 s 处可为选框边缘或长选框内部，按 §19 连续性验收及整条 lane mask 后重采样的参考消除歧义。
D44（2026-11-18）：full 方法的选区超过 2^24 个样本时，公共 DSP API 抛出值错误，HTTP 入口返回可见的客户端错误。§8.4 要求 FFT 覆盖整个选区并限制长度，拒绝可避免静默丢弃尾部样本。
D45（2026-11-18）：T-F mask 在选区边缘以内保持单位增益，时间和频率轴各在选区外两个帧或 bin 步长内以半余弦降为零，角部权重相乘，分块始终使用原选区边界。HTTP PCM 入口拒绝实际 float32 窗不满足 NOLA 的 Gaussian 参数，以免返回无效试听。
D49（2026-11-18）：CLI 通过现有鉴权 `POST /open` 的私有接续流程，以一次性标识将本次 tensor 启动与浏览器解释对话框绑定。冷启动和热启动复用限时内存登记，避免文件路径进入启动 URL 或浏览器存储，并保留原有文件打开接口。
D46（2026-11-18）：未指定 mel 参数时使用参考实现的 128 个通道、0 Hz 至 Nyquist 和 Slaney 间距，沿用校准后的功率和 Slaney 归一化。显式传入的参数优先，以便对照参考实现和模型配置。
D47（2026-11-18）：raw feature 用 §6 的 framed f32 保留原始有限值，避免半精度溢出或产生不可用的 JSON 最大值。五种 dB 类尺度沿用 f16，在文件或 HTTP 边界拒绝无效转换，避免发布无效 lane。
D48（2026-11-18）：静态 spectrogram 在单个 axes 上绘制并标注第一个通道，compare 逐通道绘制且共用范围。差值按参数顺序相减，全零差值使用 ±1 dB，以保持色标以零为中心。安装 skill 须显式选择至少一个目标，建立链接前统一检查目标冲突，以保留原有文件并避免部分安装。
D50（2026-11-18）：频谱删除在 `params.gain_db` 中传字符串 `"-inf"`，分组编辑在 `params.lane_ids` 中传其他选中 lane，纯时间提取用 `spectral_extract` 只传时间界限。提取的 lane 从源 offset 加舍入后的起始样本时间开始，撤销与重做作用于会话的最近一组历史。确认写回原文件后，Save 省略 `path`。Save As 要求解析后的目标与源文件不同。以上约定复用 §15 的接口，并让原文件写回经过显式确认。
D52（2026-11-18）：录音沿用鉴权 HTTP 与 §6 的服务端 WS。arm 与 Calibrate 分别用 `POST /api/record/arm` 和 `POST /api/record/calibrate`，WS 发送录音状态、电平和 framed f32 波形预览。新连接在已 arm 或录音中收到当前状态，初始 idle 隐含，以保持空闲客户端原有消息序列。输入通道线上从 0 编号、界面从 1 编号。Mixdown 与 overdub 共用可听轨、增益与采样位置规则，混合单声道与立体声时将单声道复制到左右声道。普通录音保留全部样本，只有 overdub 裁去补偿延迟且保持会话起点。替换轨道可撤销并保留原始文件，同秒同名录音以追加后缀保留各次录音。
D53（2026-11-18）：Analyzer 请求沿用 §7，边界使用会话秒，省略边界时取整条 lane，音频通道从 0 编号。图像、曲线、事件和音频返回派生 lane ID，并复用原有读回接口。TimeCurve 与 Spectrum 使用具名 framed f32 数组，单条曲线按一行编码并保留 NaN 缺口；Events 和 Scalars 使用 JSON。时间原点取舍入后的音频样本或首个入选的 feature 帧中心；曲线与事件的时间只换算一次并使用父 lane 的 offset，派生图像与音频放在实际分析起点。重跑同一父 lane 与 analyzer 的结果时复用对应 lane ID、推进版本并清除 stale。源文件变化或移除时即使 analyzer ID、版本相同也使相关缓存失效，现有结果标记 stale，并通过既有 WS 事件刷新列表和会话。
D54（2026-11-19）：目录与清单共用解析后的来源和文件路径及稳定行号。清单保留原顺序与自带元数据，重名列用 `meta.` 区分。界面与 CLI 复用 CPU 扫描、SQLite 缓存以及相同顺序的表格和 CSV 列。Scalar 参数按声明类型传递，结果列用 `<analyzer-id>.<result-key>` 命名，失败记在对应行。分组 LTAS 按筛选后的行计算，并在同一频率网格上传输 framed 结果。
D55（2026-11-19）：按 H48 在 RIR 面板增加带符号的系数–延迟图及直达参考和后续到达标记，复用帧格式与波形路由。标记读取原始样本并独立于分析指标，以便分别比较到达时间与混响结果。
D56（2026-11-27）：RIR 测量与分析复用 phase-M7 定义的请求、响应、派生图与无效条件。sounddevice 录音使用公开的输出缓冲区并按锁定版本逐块写入；writer 线程负责磁盘写入。任一 take 出现 overflow 或 underflow 时整次测量无效。
D57（2026-11-27）：Docker 镜像在构建时编译前端并安装锁定的 Python 依赖；Compose 将服务端口只发布到本机 8765，并用命名卷持久化 VSR_HOME。`vsr serve --no-browser` 输出带访问 token 的本机 URL，便于从容器日志打开页面；`docker compose down` 删除容器与网络但保留数据卷。
