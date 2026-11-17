# AGENTS.md — Visualized! Speech Research（vsr）

本仓库实现 `docs/DESIGN.md` 描述的 vsr。DESIGN.md 是唯一事实源：功能范围、技术栈、接口、DSP 定义与验收标准都以它为准。

## 工作方式

- 与 Human 交流用中文。
- 按 DESIGN.md §19 的顺序实现 M0 → M7。上一个 milestone 的验收清单全部通过后，才开始下一个。
- 每个 milestone 结束时向 Human 汇报：验收清单逐条结果（通过 / 失败 / 未验证及原因）、e2e 截图路径、§17 在本平台的实测数值（与同平台上一次的比较）、与 DESIGN 不一致之处。
- DESIGN 未覆盖或有歧义时，选符合 DESIGN §0 原则的最简单实现，并在 DESIGN.md §21 追加一行记录。如果该选择会改变用户可见的功能范围、涉及数据安全，或需要新增运行时依赖，先停下来问 Human。
- 不实现 DESIGN §1「v1 不做」中的任何一项，也不为它们预留接口或配置。
- `src/vsr/skills/vsr-speech-visualization/`（配套 skill 与 `presets.toml`）是设计的一部分，内容由 Human 决定，实现 task 不修改它；实现与它不一致时改实现。
- UI 交互按 DESIGN §9.6 照 Audition 的惯例；不使用 Adobe 的图标、logo、产品名或其他素材。

## 技术栈（锁定）

- 后端：Python ≥ 3.11、uv、FastAPI、uvicorn、torch、numpy、scipy、soundfile、sounddevice、librosa；可选 pyworld、safetensors。
- 前端：React + TypeScript（strict）+ Vite、Mantine、@tabler/icons-react、dockview、uPlot、AG Grid Community、zustand；测试用 vitest 与 Playwright。
- 不替换上述库。新增运行时依赖须先经 Human 同意，并记入 DESIGN §21。

## 命令（M0 负责建立；之后每次提交前全部通过）

```bash
uv sync                                    # torch 先按本机（CPU / CUDA / MPS）装好对应版本
uv run pytest
uv run ruff check . && uv run ruff format --check .

cd frontend
npm ci
npm run typecheck && npm test              # tsc --noEmit + vitest
npm run lint                               # eslint --max-warnings 0
npm run build                              # 输出到 ../src/vsr/web/
npx playwright install chromium            # e2e 用的 Chromium；设了 VSR_E2E_CHROMIUM（DESIGN §20）的平台不需要
npx playwright test                        # e2e，使用 Playwright 的 Chromium

# 开发：两个终端
uv run vsr serve --dev               # 后端 8765，打印带 token 的 Vite 地址
cd frontend && npm run dev                 # Vite，代理 /api 与 /ws
```

## 代码约定

- 代码、注释、commit message、测试名用英文；`docs/` 下面向 Human 的文档用中文。
- DSP 只在后端实现；前端只做显示换算（colormap、dB 范围、坐标映射）。
- torch 计算一律经 `compute_device`（DESIGN §4；唯一例外是数据集扫描固定用 CPU，见 DESIGN §13），不写死 `.cuda()` 或 `"cpu"`；设备上只用 float32。
- 大数组只经 `frame.py` / `frame.ts` 的 framed 格式传输。
- 每个 DSP 函数有数值测试；测试信号由代码生成，不提交二进制音频或 tensor 文件。
- 有已知限制的简化写成注释：`shortcut: <限制>, <何时升级>`。

## 开发规则（lifecycle v1）

目的：不为没有需求的情形加守卫、回退、选项、抑制与说明，也不为通过检查而改检查。适用于每个 Worker、Reviewer 与 Controller。编号与 long-term skill 的规则表一一对应；规则的措辞以下面这一块为准，V1–V6 是 vsr 的具体化。

### 规则

Errors and fallbacks
- C1 Handle errors only at the trust boundaries the spec names; elsewhere let them propagate.
- C2 No bare or blind catch, no empty handler, no swallow-and-default.
- C3 No fallback, retry, or degraded mode the spec does not define.
- C4 No defensive type, attribute, None, or length checks on guaranteed values.

Code shape
- C5 No inline lint, type, or coverage suppressions; exceptions only in linter configuration with a reason and a decision id.
- C6 No option, flag, parameter, environment variable, or config key outside the spec.
- C7 No compatibility shims before the first release.
- C8 No abstraction with a single implementation.
- C9 Delete instead of commenting out; comments explain why.

Tests
- T1 Never loosen tolerances, delete or weaken assertions, add unconditional skip/xfail/only, or mock the unit under test to get green; report BLOCKED with the failing output. Conditional skips (skipif, importorskip) state their reason.
- T2 Bug fixes start with a test that fails on the old code.
- T3 Tests check specified behaviour, not implementation details.

Process
- P1 Finish in-scope work without asking; ask only at the lifecycle gates.
- P2 Plans, stubs, and TODOs are not implementations.
- P3 Done means the checks ran in this task on the final tree.
- P4 Reports state facts only.
- P5 No re-asking recorded decisions, no re-running unchanged checks, no review rounds beyond the cap.
- P6 This section, linter configuration, and the rule check are human-owned.

Kept regardless: trust-boundary validation, data-loss handling, security, resource cleanup.

Check: `python3 scripts/check_diff_rules.py --base <base ref>` on every task diff; FAIL blocks the merge, every REVIEW line needs a disposition.

### vsr 的具体化

**V1 DESIGN 已定义的边界处理（C1、C3 的依据）。** 下表之外的位置不写 `except`、回退、重试与降级，让异常传播。表里的回退要可见：显示给用户，或写在结果里。规则检查的 REVIEW 行，disposition 写表中的编号，例如 `V1#4`。

| # | 位置 | 处理 | DESIGN |
|---|---|---|---|
| 1 | HTTP 入口 | pydantic 校验参数；错误返回 4xx / 5xx，body 为 `{error, detail, traceback}`，前端用 notification 显示 | §3、§7 |
| 2 | analyzer 插件 | import 失败的模块在列表里显示错误，不影响其他插件；运行异常返回 traceback，server 继续服务 | §12 |
| 3 | 录音 | 任何异常先关闭已打开的文件，再向上传；callback 的 overflow / underflow 记录并显示，不静默 | §11、「不可省略」 |
| 4 | `sounddevice` 导入 | 失败时 `/audio/devices` 返回空列表与原因，server 照常启动 | §4 |
| 5 | 计算设备 | self-check 失败回退 cpu，UI 显示原因 | §4 |
| 6 | 数据集扫描 | 读取失败的文件保留一行，`error` 列写原因，扫描继续 | §13 |
| 7 | 保存 | 临时文件 + `os.replace`；写入中途失败时原文件不受影响 | §4、§15、§19 M3 |
| 8 | tensor 载入与 `vsr.show` | `weights_only` 拒绝时向用户报错；server 未运行、hostname 不一致、layout 推断失败时抛出异常并给出提示 | §4、§10 |
| 9 | RIR | 找不到噪声底时 `t_c` 取信号末尾、不补偿；拟合下限低于噪声底 + 5 dB 时该项返回 null 并给出原因；测量中出现 overflow / underflow 则标为无效 | §14 |
| 10 | f0 内置插件 | 装了 pyworld 用 harvest，否则用 `librosa.pyin`；结果里标明所用方法 | §12 |

**V2 数值代码里没有保护性代码（C1、C4）。** `src/vsr/dsp/` 不加 `nan_to_num`、`clip`、`clamp`、`np.errstate`、对 shape 或 dtype 的重复校验与 `try/except`，除非 DESIGN 的公式本身写了它（例如 §8 的 dB 下限、§14.2 的 ε(f)），并在该行的注释里写 `DESIGN §x.y`。输入只在两处校验一次：HTTP 入口（pydantic）与公共 API 入口（§16 的 `vsr.dsp.*` 接受 Tensor 或 ndarray）。检查：`grep -rnE 'nan_to_num|errstate|clip\(|clamp\(' src/vsr/dsp` 的每个命中都带 `DESIGN §` 注释，reviewer 逐条核对。

**V3 选项只有 DESIGN 定义的（C6）。** config.toml 的键（§4 的表）、CLI 子命令与参数（§4、§16）、环境变量（`VSR_HOME`、`VSR_URL`、`VSR_TOKEN`；另有只供 e2e 使用、只由 `playwright.config.ts` 读取的 `VSR_E2E_CHROMIUM`，§20）、HTTP 路由（§7）。多一个就是缺陷；不为 §1「v1 不做」的功能预留接口或配置（见「工作方式」）。检查：drift audit，reviewer 对照这几张清单。

**V4 不加只有一个实现的抽象（C8）。** 除 §3、§18 列出的模块与 §12 的 analyzer registry 之外，不新增 base class、factory、registry，也不新增对 `soundfile`、`torch.stft` 的包装层。检查：reviewer。

**V5 测试（T1、T3）。** DSP 数值测试对照解析值或 scipy / librosa 的参考实现，容差取 §19 写的数，不放宽；测试信号由代码生成，随机数固定 seed（§20）；e2e 断言 §19 写明的可观测量（请求个数、RMS、曲线条数），不以「没有异常」代替；不提交把自己的输出当期望值的快照。只能靠肉眼判断的 e2e 项（截图）不作验收门槛（§20）。检查：reviewer；`.only` 由 vitest 与 Playwright 的配置挡住，条件 skip 由规则检查脚本挡住。

**V6 过程（P1–P6）。**
- 不向 Human 询问可逆的事；gate 请求写明属于哪个 gate（long-term skill 的 gate 表，或 `LIFECYCLE.md` 的项目 gate）。
- 验收项无法诚实通过：报告 BLOCKED 并附失败输出，不改验收标准，不放宽容差（`LIFECYCLE.md` 项目 gate 2）。
- 不重复运行已通过且未变的检查；一个 task 的 review 不超过契约规定的轮数。
- 不新建说明、总结、报告类的 `.md` 文件：除 `docs/DESIGN.md`、`docs/plugins.md`、`docs/manual-checks.md`、`docs/acceptance/`、`docs/dev/performance.md`（§17 的各平台数值）、`CHANGELOG.md` 之外，Worker 不新增文档。工具所需的配置与脚本文件，在 task 的 deliverable 写明时才新建。
- 报告只写事实：改了什么、跑了什么、结果、还有什么没做；不写假设性的风险清单。

### 常见的写法，与规则下应该怎样写

| 想写的 | 改为 |
|---|---|
| `try: p.unlink()` 配 `except FileNotFoundError: pass` | `p.unlink(missing_ok=True)`，或 `with contextlib.suppress(FileNotFoundError):` |
| `if cond: pytest.skip(...)` | `@pytest.mark.skipif(cond, reason="…")`；可选依赖用 `pytest.importorskip("pyworld")` |
| `except Exception: return None` | 让异常传播；在 V1 表里的位置，按 DESIGN 处理 |
| `except OSError: continue` | 在 V1 表里的位置（例如 #6）把原因记入结果；其他位置让异常传播 |
| 前端对类型上不可为空的值写 `a?.b ?? 0` | `a.b` |
| 前端 `catch {}`、`.catch(() => {})`、`catch (e) { console.error(e) }` | 在边界处用 notification 显示错误；其他位置不 catch |
| e2e 里 `if (!x) return;` 或 `test.skip(cond, …)` | 直接断言；e2e 不用条件 skip，依赖设备的检查放进 pytest，用 `skipif` 并写原因 |
| `# noqa`、`# type: ignore`、`// @ts-ignore`、`/* eslint-disable */` | 不写；确需例外时，在 linter 配置里加一行，附理由与决策编号，走 Rules gate |

### 保护区与规则检查

- 实现 task 不修改：`AGENTS.md`、`LIFECYCLE.md`、linter 与类型检查配置（`pyproject.toml` 的 `[tool.ruff*]` 表、`frontend/eslint.config.js`、`frontend/tsconfig.json` 的 strict 相关项、vitest 与 Playwright 配置里禁用 `only` 的项）、`scripts/check_diff_rules.py`、`src/vsr/skills/`，以及 `docs/DESIGN.md` 的 §0、§1、§16、§17、§19。DESIGN 的其余章节：实现 phase 只往 §21 追加，只有 `arch` phase 可改 §2–§15、§18、§20；`LIFECYCLE.md` Checks 的「DESIGN 保护区检查」逐章核对。需要改时，写成提案：规则、配置与脚本走 Rules gate，DESIGN 与配套 skill 走 Scope gate。
- 规则检查在仓库根运行：`python3 scripts/check_diff_rules.py --base <base ref>`。task 分支的 base 是它被切出的 ref，phase integration 的 base 是集成分支 `master`（hotfix 周期里是 `hotfix/<version>`，见 `LIFECYCLE.md` Integration）。输出一行一条：`FAIL|REVIEW <规则编号> <路径>:<行号>: <文本>`，末行 `N FAIL, M REVIEW`；有 FAIL 时 exit 1。FAIL 阻断合并。每条 REVIEW 由 Task Reviewer 给出 disposition：允许（写 `V1#<n>`）、随 spec 变化（写 `§21 D<n>`），或缺陷（返工）。
- linter 配置在 `pyproject.toml` 与 `frontend/eslint.config.js`，每个关掉的规则或例外都带理由与决策编号。

## 不可省略

- 只绑定 127.0.0.1（除非用户显式传 `--host`）；所有 `/api` 与 `/ws` 校验 token。
- `torch.load(weights_only=True)`、`np.load(allow_pickle=False)`，不提供关闭开关。
- 录音：callback 只入队，writer 线程流式写入磁盘；任何异常先关闭文件；overflow / underflow 记录并显示给用户。
- 保存：临时文件 + `os.replace`；未经用户显式保存不写回原文件；不往数据集目录写任何文件。
- RIR 测量幅度 > −6 dBFS 时需要用户二次确认。

## Git

- 每个 milestone 通过验收后一个 commit，message 形如 `M1: spectrogram viewport and frequency analysis`。这里的 commit 指代码；`docs/dev/` 的 `records:` 提交另算（`LIFECYCLE.md` State and records、D29）。commit 与 push 按 `LIFECYCLE.md` Integration 的规则（常设授权）。
- commit 中不加入任何 AI 署名：不加 `Co-Authored-By`、`Generated-by` 等 trailer，正文也不写 AI 声明。
- 不提交 `src/vsr/web/`、`node_modules/`、测试产物与录音文件。
