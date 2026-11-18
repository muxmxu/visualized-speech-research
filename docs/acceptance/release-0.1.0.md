# 0.1.0 发布候选验收

基于已交付的 M3 `7cf8df9c5ee64abfbbdc9aa0b355190d1c8d5dc8`。Worker 冻结基点为 `c04c7e2a630435141e1e275b61bcc2004843e45e`。两份交付文档随工作树交接，集成后由 Controller 固定最终候选提交。

| 编号 | 结果 | 证据 |
|---|---|---|
| R1.1 | 通过 | 与已交付 M3 和已审的 M3 阶段最终树比较，产品、配置、锁文件和测试一致。沿用 pytest 260 通过、Vitest 37 通过及 Chromium 75 个不同用例的结果。 |
| R1.2 | 通过 | 核对已实现的 M0–M3 路由、布局、公共 API 签名和里程碑验收记录。B5 沿用匹配锁文件的审计结果，见下。 |
| R1.3 | 通过 | 规则检查与保护区检查结果见下。 |
| R1.4 | 通过 | 三个原始脚本各运行一次，退出码均为 0，取得 §17 七项三次中位数。 |
| R1.5 | 通过 | 发布验收与根目录 `CHANGELOG.md` 记录 M0–M3 功能、差异、安装、基准及发布前置条件。 |
| R1.6 | 通过 | wheel 内容与生产资源及配套 skill 相符。干净临时环境安装并启动成功，取得 HTTP 401 / 200 / 200。 |
| R1.7 | 未验证 | B2 许可与归属由 Human 决定，整树和全部提交元数据的最终公开仓库扫描由 Human 确认。 |
| R1.8 | 未验证 | Worker 已扫描交付 diff、整树和可达提交元数据。历史元数据有待 Human 处置，最终确认待定。 |

## M0–M3 与 DESIGN 核对

| 阶段 | 已交付范围与证据 |
|---|---|
| M0 | 本地 CLI、token、framed 传输、文件打开、波形、选区、同步播放与设备切换。见 [M0 验收](M0.md)。 |
| M1 | STFT 频谱、频率分析、预设与 Copy spec、时频选区试听、多 view、可见工作区 PDF。见 [M1 验收](M1.md)。 |
| M2 | Tensor 打开与推送、feature lane、mel、静态绘图、skill 安装。见 [M2 验收](M2.md)。 |
| M3 | §15 编辑操作与保存。保存以同目录临时文件和原子替换完成。见 [M3 验收](M3.md)。 |

按 DESIGN §4、§7、§15 核对已交付 CLI、配置与路由，沿用 M3 对四条编辑路由及既有路由的检查。§16 已交付的十个公共签名为 `show`、`resolve_preset`、`spec_line`、`dsp.stft_db`、`dsp.mel_db`、`dsp.welch`、`plot.spectrogram`、`plot.compare`、`plot.spectrum` 和 `plot.savefig`，签名检查全部通过。§18 已实现路径与 M3 检查基线一致。D49 与 D50 分别记录了 CLI 接续及编辑接口细节。此次核对未发现需要更改 M0–M3 代码的 DESIGN 偏差。M4–M7 的录音、多轨、analyzer 插件、数据集及 RIR 仍按计划排期。

## 回归证据

复用 M3 的 `uv sync`、pytest、Ruff lint 与格式检查、`npm ci`、TypeScript 类型检查、Vitest、ESLint、生产及测试构建结果，命令退出码均为 0。pytest 为 260 通过，CUDA 和 MPS 不可用各跳过 23 项，另有一条 Starlette TestClient 弃用警告。Vitest 为 37 通过。

系统 Chromium 156.0.8078.79 首轮完整运行 74 通过、1 失败，退出码 1。窄屏测试的 Gain label 同时匹配轨道输入与新增选区增益控件。A1 用角色和精确名称限定原轨道输入，保留全部断言。单用例复测退出 0，修正后的类型检查和该文件的 ESLint 退出 0。因此有 75 个不同用例取得通过结果。M3 编辑截图为 `frontend/test-results/screens/M3-edit.png`，其他截图见各阶段验收。

## B5 依赖审计

沿用同一 `frontend/package-lock.json` 的本地 `npm-runtime-audit.json` 和 `npm-all-audit.json`。生产依赖 0 项，全量开发工具链 12 项 high。下表列出审计报告中的依赖路径和建议版本。锁文件保持一致，建议版本留待 B5 处理。

| 审计依赖链（节点位于 `node_modules/`） | 审计建议 |
|---|---|
| `vite → picomatch / tinyglobby`，`tinyglobby → picomatch / fdir → picomatch` | `vite@6.2.7` |
| `@vitejs/plugin-react → vite` | `@vitejs/plugin-react@5.2.0` |
| `vitest → picomatch / tinyglobby / vite` | `vitest@3.1.4` |
| `typescript-eslint → @typescript-eslint/eslint-plugin / parser / typescript-estree / utils`，其中 `parser → typescript-estree → tinyglobby`，`utils → typescript-estree`，`eslint-plugin → parser / type-utils / utils`，`type-utils → typescript-estree / utils` | `typescript-eslint@8.47.0` |

## 构建与安装

M3 的生产 `npm run build` 退出 0，Vite 8.3.8 用时 1.24 秒，保留 JS chunk 大小提示。复制三个真实文件并逐个比对 SHA-256。此次 `uv build --offline` 退出 0，生成 345,220 字节的 `visualized_speech_research-0.1.0-py3-none-any.whl` 和 1,028,194 字节的 sdist。wheel 共 32 个条目，CRC 通过，三个 `vsr/web/` 资源的 SHA-256 均与复制前的 M3 文件一致，`SKILL.md` 和 `presets.toml` 与源文件逐字节一致。

第一次离线安装 CPU torch 时，CPU 索引优先级遮蔽了锁定的 `filelock` 版本，退出 1。单独装 torch 后，通用离线依赖解析缺少 SciPy 索引记录，退出 1。最终在临时 Python 3.12.14 venv 中，从锁定的 CPU 索引缓存单独安装 `torch==2.15.0+cpu`，再用 `uv sync --locked --offline --no-dev --no-install-project` 安装锁定依赖，从 wheel 安装项目并运行 `uv pip check`。最终各步退出 0。

从临时目录启动已安装的 `vsr serve --no-browser --port 0`，使用临时 `VSR_HOME`。无 token 的 `GET /api/session` 返回 401，带 token 返回 200，`GET /` 返回 200 且引用生产 JS。`vsr.resolve_preset("analysis", 48000)` 返回 Hann、`win_length=2048`、`hop=512`、`n_fft=2048`。`importlib.resources` 成功读取 1,351 字节的 `presets.toml`。冒烟脚本退出 0，server 收到 SIGTERM 后退出，临时环境已清理。

wheel SHA-256 为 `e22cdb5361f24185d748ba508799435b54e65c50b57f5a3fda5c1ff4c8e9565f`。sdist SHA-256 为 `935dd5de92ea2fc550f2ea7ab312f69d0296d6e52fa8fb414ba575bc8d801d7e`。

## §17 同平台三次中位数

Raspberry Pi 5，Linux aarch64，CPU，Chromium 156.0.8078.79。三个脚本依次在与发布候选运行代码逐字节一致的 M3 环境运行，独占检查锁，均退出 0。同平台、同设备上次记录来自 M0–M2，[实测记录](../dev/performance.md)。本版本是 C1 首个发布候选。

| §17 | 指标 | 三次实测 | 中位数 | 上次中位数 | 变化 |
|---|---|---|---:|---:|---:|
| 1 | 10 分钟立体声首次波形（s） | 4.304 / 4.453 / 4.331 | 4.331 | 4.173 | +0.158 |
| 2 | 首次画出频谱（s） | 3.4442 / 3.3837 / 3.2825 | 3.3837 | 3.5291 | −0.1454 |
| 3 | 缓存平移或缩放往返（ms） | 63.0 / 76.9 / 59.5 | 63.0 | 71.1 | −8.1 |
| 4 | dB 范围或调色板变更（ms） | 5.6 / 5.7 / 5.9 | 5.7 | 5.4 | +0.3 |
| 5 | 60 s 单声道改 n_fft 后重画（ms） | 558.9 / 548.8 / 571.8 | 558.9 | 565.9 | −7.0 |
| 6 | 平移或缩放期间重画（fps） | 43.13 / 42.35 / 43.39 | 43.13 | 43.46 | −0.33 |
| 7 | `vsr.show()` 到 lane 出现（ms） | 135.418 / 165.124 / 443.229 | 165.124 | 224.288 | −59.164 |

第 4 行三次均为 0 个网络请求、0 帧间隔。第 1、4、6 行较上次略慢。波形脚本记录端到端结果，没有分段计时。首次频谱绘制的每次第二声道请求体完成耗时约 5.02–5.33 s，改 n_fft 的请求体完成耗时与重画耗时接近。§17 的参考值用于比较，验收以成功取得实测数据为准。

## 冻结与公开发布

相对阶段基点，唯一拟交付文件为 `CHANGELOG.md` 和本报告。规则检查为 0 FAIL、0 REVIEW。DESIGN 前言、标题及 §0–§21 和所有受保护文件及配置逐字节一致。拟交付 diff 无扫描命中。整树和 70 个可达提交的预扫描在提交元数据中发现账户标识和邮箱模式命中，明细保留在本地。Human 最终公开仓库扫描和 B2 许可与归属仍待确认。

wheel、sdist、命令退出码、三个基准的原始样本及 SHA-256 清单保存在忽略的 `tmp/C1-release-preflight`。Worker 冻结交付文档和产物供集成，集成后由 Controller 记录最终候选提交和同平台性能行。签注 tag、GitHub Release 与包索引发布均待后续授权步骤。
