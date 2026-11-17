# Cycle C1 plan — vsr 0.1.0（M0–M3）

作者：Claude `opus`，决策型 Controller，兼任 Overall Planner（2026-11-16）。2026-11-16 按 long-term skill 的状态布局，由 `overall-plan.md` 移入本文件（T4）：各 phase 的目标、exit criteria 编号与风险沿用原文；增加了 phase `release`、目标版本与周期层面的说明，M4–M7 的行移到文末，留给 C2、C3 的周期计划参考。之后对本文件的修改一律按契约「延续规则」作 amendment，在本文件上修改并在 `decisions.md` 记录。

## 周期

- 周期 C1，目标版本 0.1.0（版本方案见 `LIFECYCLE.md` Delivery）。内容：DESIGN §19 的 M0–M3，加上 phase `release`（周期整合与交付）。
- 后续周期（各自开始时再写计划）：C2 = M4–M5 → 0.2.0；C3 = M6–M7 → 0.3.0（`LIFECYCLE.md` Roadmap）。
- 没有 `arch` phase：DESIGN §0–§20 对 M0–M3 已经完整，并经过设计 review 与关闭复审（D10–D13 是 run 之前的决策，记录在状态目录的 `history/`，见 `docs/dev/decisions.md` 开头的说明）。实现中遇到的缺口，由遇到它的 task 按 AGENTS.md「工作方式」记为 DESIGN §21 的一条决定；缺口需要 spec delta 时，按延续规则作 amendment，增加 `arch` phase。
- 顺序：M0 → M1 → M2 → M3 → release 严格串行（单个 Controller，减少合并冲突）。depends 列是真实依赖，供 amendment 时参考。
- 本 plan 不经 Plan Review；M0 的 Plan Review 核对 Human 需求的归属与 exit criteria 的覆盖。
- M0 另须写入开发规则的配套配置（D25 是 run 之前的决策，记录在状态目录的 `history/`，见 `docs/dev/decisions.md` 开头的说明）：`pyproject.toml` 的 `[tool.ruff*]` 表、`frontend/eslint.config.js`、`package.json` 的 `lint` 脚本、vitest 的 `allowOnly: false, retry: 0`、Playwright 的 `forbidOnly: true, retries: 0`，文本取自 `docs/dev/rules-config.md`，`D<n>` 已填 D25；TypeScript 限在 6.0.x（同文件）；另在 `pyproject.toml` 补 `[tool.pytest.ini_options]` 的 `testpaths = ["tests"]`，因为 task 与 phase 的 worktree 在仓库内的 `agent_workspace/` 下，不限定 `testpaths` 时 pytest 会收集到其他 worktree 里的测试。写入后它们属于 Protected standards。前提是 Human 已勾选启动授权补充的第三项。

## Exit criteria 编号

- **M<k>.<i>**：DESIGN §19 中 milestone M<k> 的验收清单第 i 条，按出现顺序从 1 编号。按 2026-11-16 的 DESIGN：M0.1–M0.6、M1.1–M1.12、M2.1–M2.6、M3.1–M3.5；§19 改动时重数。
- **M<k>.C1 – C3**：每个 milestone phase 的三条共同 exit criteria，定义见 `LIFECYCLE.md` Roadmap（全部 check commands 通过；验收报告写明每条的结果与证据；补充决定已记入 §21 且保护区未被改动）。
- §19 中写给 Human 做的真机检查条目：其 exit criterion 是 `docs/manual-checks.md` 中对应条目已写好、步骤可执行；真机检查本身由 Human 完成，不阻塞 phase（C1 范围内没有这类条目，M4、M7 才有）。
- **R1.1 – R1.8**：phase `release` 的 exit criteria，见下。

## Phases

| id | goal | exit criteria | depends | risk |
|---|---|---|---|---|
| M0 | 骨架：CLI 与 token、framed 传输、文件打开、Lanes 波形视图、播放、深色 dockview 布局、计算设备与 self-check | M0.1–M0.6、M0.C1–C3 | — | normal |
| M1 | 频谱视口、Display 与 presets、Frequency Analysis、T-F 选框与框内试听、`vsr.dsp` 基础 API | M1.1–M1.12、M1.C1–C3 | M0 | high（DSP 标定与核心渲染决定后续所有 phase） |
| M2 | tensor 载入与 `vsr.show` 推送、feature lane、mel、`vsr.plot`、`vsr skill install` | M2.1–M2.6、M2.C1–C3 | M1 | normal |
| M3 | 编辑：波形编辑、T-F 选框删除 / 增益 / 提取、undo / redo、保存 | M3.1–M3.5、M3.C1–C3 | M1 | high（保存会改写用户文件） |
| release | 周期整合与交付：全量回归、drift audit、docs 同步、性能测量并记录（§17）；版本 0.1.0、CHANGELOG、release 验收报告、install smoke、本地 tag | R1.1–R1.8 | M0–M3 | normal |

每个 milestone phase 的 phase plan 以一个 phase integration task 结束（合并、全量回归、`docs/acceptance/M<k>.md`）；task 与分支规则见 `LIFECYCLE.md` Integration。

## release phase 的 exit criteria

- **R1.1** 集成分支上，全部 check commands 通过（`LIFECYCLE.md` Checks），含 M0–M3 的验收测试；没有因环境缺失而改为跳过的项（DESIGN §20 的设备 `skipif` 不算，见 `LIFECYCLE.md` Checks），缺失项记 NOT RUN 并报告。
- **R1.2** drift audit 完成：按 `LIFECYCLE.md` 的 Drift map 双向比对 DESIGN 与代码，每个 finding 已修复、记为 §21 决定，或交 Scope gate；没有未处理的 finding。
- **R1.3** docs 同步：`LIFECYCLE.md` 的 Docs to sync 中属于 C1 范围的文档与代码一致（§21 的决定行、`CHANGELOG.md`）。
- **R1.4** 性能（D33、H27）：DESIGN §17 第 1–7 行在 run 所在的每个平台上、该平台可用的每个 `compute_device` 各测一次（3 次的中位数），数值写入 release 报告，并与同平台上一次的数值比较，回退写进 release 报告；release phase 的 integration task 在 squash 之后，在主工作树里把这次的测量行追加到 `docs/dev/performance.md`，不写在 task 或 phase 分支上（`LIFECYCLE.md` Checks 的 Performance budget）。§17 的数值是参考值，不作通过条件；没有为接近参考值而删减功能。
- **R1.5** 版本与记录：`pyproject.toml` 的版本为 0.1.0；`CHANGELOG.md` 有 0.1.0 一节；`docs/acceptance/release-0.1.0.md` 存在，含 M0–M3 各验收报告的结论、与 DESIGN 的偏离、未决项。
- **R1.6** install smoke 通过：从构建出的 wheel 在干净环境中安装并按 `LIFECYCLE.md` Delivery 的步骤运行，输出记入 release 报告。
- **R1.7** 集成分支的 release commit 上有本地 tag `v0.1.0`；release、tag、commit 与报告路径记入 worklog 与 STATUS；controller 经 human channel 发出 heads-up。不 push、不发布。
- **R1.8** 保护区自基线以来未被改动；受跟踪文件的公共仓库扫描（整棵树，`LIFECYCLE.md` Checks）无命中。

## Human 需求的归属（编号见 `human-inputs.md`）

| 需求 | phase |
|---|---|
| H1 Audition 式颜色与频谱 / 波形编辑 | M1、M3 |
| H2 原生加载 torch tensor | M2 |
| H3 数据集分析 | C3（M6），不在本周期 |
| H4 浏览器前端、现成 UI 库 | M0（之后各 phase 沿用） |
| H5 单轨 / 多轨录音 | C2（M4），不在本周期 |
| H6 频谱预览与 FFT 参数 | M1 |
| H7 Python + PyTorch 后端、交互可视化 | M0、M1 |
| H8 FFT 与时间段频率分析 | M1 |
| H9 speech 研究的各种可视化 | M2（mel / feature）、配套 skill；插件在 C2（M5） |
| H10 RIR 可视化 | C3（M7），不在本周期 |
| H11 Claude 设计、Codex 实现 | 设计阶段已完成；实现由整个 run 完成 |
| H12 项目名 / vsr | 设计阶段已完成 |
| H13 配套 skill | 设计阶段已写成；M1（presets）、M2（`vsr.plot`、`vsr skill install`） |
| H14 计算设备 mps / cpu / cuda | M0（选择与 self-check）、M1（DSP 测试按设备参数化） |
| H15 不做 VST / 插件 I/O | DESIGN §1 已排除 |
| H16 Fable review、workflow、Codex 自动迭代 | 设计阶段已完成；自动迭代即整个 run |
| H17 Audition 式友好 UI、频谱框选试听与删除 | M0–M3 的 UI（DESIGN §9.6）；M1（框选、试听）；M3（删除、增益、提取） |
| H18 完整产品流水线；开发与维护全部交给 AI；超长 run；开发规则对付过度防御 | 整个 run（`LIFECYCLE.md`、host contract、状态目录；开发规则见 AGENTS.md「开发规则（lifecycle v1）」，待合并） |
| H19 三层放置；vsr 可能共享或公开，受跟踪文件不得含个人信息 | 每个 phase 的 check commands（公共仓库扫描）；R1.8 |

## Budget 估计

每个 phase 约 5 个实现 task + 1 个验收 task；每个 task 需要 Worker、Auditor、Reviewer 各一次，加上 Phase Planner、Plan Reviewer，以及约 25% 的返工，合计每个 phase 约 25 次 invocation。C1 有 5 个 phase（M0–M3 与 release），约 125 次，其中 `sol` 档约 45 次（与原估计同比例：8 个 phase 约 200 次，其中 `sol` 档约 70 次）；预计不需要 `astra`。没有付费算力或外部费用。预算上限：未设（host contract 待审定事项 5）。

## Human 介入点

- 阻塞：启动授权（`human-inputs.md`）；`LIFECYCLE.md` 的各 gate（Authorization boundary、Commit authorization、Budget、Scope、Rules、Ladder end、项目 gate）。
- 不阻塞：每个 milestone phase 结束的 heads-up；M1 结束后的 UI 检查（Human 看截图或自己运行 `vsr`，意见写进 `INBOX.md`，下一次 intake 处理）。

## 后续周期的 phase 预置（原 overall plan 的 M4–M7 行，供 C2、C3 规划参考，不是本周期的内容）

| id | goal | exit criteria | depends | risk |
|---|---|---|---|---|
| M4 | 录音与多轨：设备、电平、流式写入磁盘、overdub、mixdown | M4.1–M4.6、M4.C1–C3 | M0 | high（录音数据不可丢） |
| M5 | Analyzer 插件系统与内置插件、`docs/plugins.md` | M5.1–M5.4、M5.C1–C3 | M1、M2 | normal |
| M6 | 数据集分析与 `vsr scan` | M6.1–M6.5、M6.C1–C3 | M1、M5 | normal |
| M7 | RIR 分析与 ESS 测量、`vsr.dsp.rir_metrics`、`vsr.plot.rir` | M7.1–M7.5、M7.C1–C3 | M1、M4 | high（数值正确性） |
