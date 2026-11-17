# Cycle C1 plan — vsr 0.1.0（M0–M3）

作者：Claude `opus`，决策型 Controller，兼任 Overall Planner（2026-11-16）。2026-11-16 按 long-term skill 的状态布局，由 `overall-plan.md` 移入本文件（T4）：各 phase 的目标、exit criteria 编号与风险沿用原文；增加了 phase `release`、目标版本与周期层面的说明，M4–M7 的行移到文末，留给 C2、C3 的周期计划参考。之后对本文件的修改一律按契约「延续规则」作 amendment，在本文件上修改并在 `decisions.md` 记录。

## Amendment A1 — 2026-11-17

This is the sole Planner amendment following `reports/plan-review-M0.md` FAIL and the completed independent `reports/recon-M0.md`.
Review issue 1 is closed by reconciling R1.7 and the H34–H36 requirement mapping with current LIFECYCLE Integration Push and Delivery, without adding authorization or changing the PyPI boundary.
Review issue 2 is closed as a planning-input defect in `phase-M0.md`, where the recon observations are bound and its unresolved facts remain explicit affected-task dispatch blocks.
The review's invocation note is resolved in `phase-M0.md` as 21 baseline invocations plus seven reserve invocations, with this amendment consuming one reserve seat rather than silently expanding the budget.
The original FAIL remains recorded, no second routine Plan Review is requested, and the git-executor block remains in force for task commits, dependent branching and T6.

## Amendment A2 — 2026-11-18

H45 authorizes the visible-region workspace PDF export and the associated DESIGN amendment under B3 and D40.
The `arch` phase follows accepted M0 and integrates the PDF specification before M1 implementation starts.
M1.13 appends the PDF acceptance test after the original M1.1–M1.12, and M2 reuses the export for feature and mel views as those views become available.
H48 remains assigned to M7 in C3 under B4.

## Amendment A3 — 2026-11-18

The sole Planner amendment following the independent [arch Plan Review](reports/plan-review-arch.md) and [M1 Plan Review](reports/plan-review-M1.md) FAIL records the changes below.
The [arch phase plan](phase-arch.md) adds D43 in DESIGN §§7, 9.4 and 21 to distinguish each masked PCM chunk from its full T-F rectangle before M1 dispatch.
A2 requires independent audit and review of the frozen phase revision before squash, then full checks and DESIGN diff equality on the new master revision.
The [M1 phase plan](phase-M1.md) specifies the exact M1.10 benchmark, restored M0-layout panel entry, viewport pixel assertions and source-browser-to-PDF pixel comparison.
H54 assigns practical DESIGN §9 workspace improvements and desktop/narrow Chromium captures to M1-T4, with an integrated screenshot in T8.
The original review verdicts remain recorded and the amendment follows the CODEX rule for dispatch.

## 周期

- 周期 C1，目标版本 0.1.0（版本方案见 `LIFECYCLE.md` Delivery）。内容：DESIGN §19 的 M0–M3，加上 phase `release`（周期整合与交付）。
- 后续周期（各自开始时再写计划）：C2 = M4–M5 → 0.2.0；C3 = M6–M7 → 0.3.0（`LIFECYCLE.md` Roadmap）。
- The `arch` phase covers H45 in DESIGN §§1, 9, 19, 20 and 21 and D43 in §§7, 9.4 and 21.
  The protected §1 and §19 additions are covered by H45.
- The phase order is M0 → arch → M1 → M2 → M3 → release.
- The overall plan retains its initial M0 coverage review, and the H45 amendment is covered by the independent arch and M1 Plan Reviews.
- M0 另须写入开发规则的配套配置（D25 是 run 之前的决策，记录在状态目录的 `history/`，见 `docs/dev/decisions.md` 开头的说明）：`pyproject.toml` 的 `[tool.ruff*]` 表、`frontend/eslint.config.js`、`package.json` 的 `lint` 脚本、vitest 的 `allowOnly: false, retry: 0`、Playwright 的 `forbidOnly: true, retries: 0`，文本取自 `docs/dev/rules-config.md`，`D<n>` 已填 D25；TypeScript 限在 6.0.x（同文件）；另在 `pyproject.toml` 补 `[tool.pytest.ini_options]` 的 `testpaths = ["tests"]`，因为 task 与 phase 的 worktree 在仓库内的 `agent_workspace/` 下，不限定 `testpaths` 时 pytest 会收集到其他 worktree 里的测试。写入后它们属于 Protected standards。前提是 Human 已勾选启动授权补充的第三项。

## Exit criteria 编号

- **M<k>.<i>** follows the order in DESIGN §19, with the current ranges M0.1–M0.6, M1.1–M1.12, M2.1–M2.6 and M3.1–M3.5.
- **M1.13** follows M1.12 when the H45 acceptance item is appended to DESIGN §19 and requires evidence from the visible-region PDF export in the real browser.
- **M<k>.C1 – C3**：每个 milestone phase 的三条共同 exit criteria，定义见 `LIFECYCLE.md` Roadmap（全部 check commands 通过；验收报告写明每条的结果与证据；补充决定已记入 §21 且保护区未被改动）。
- §19 中写给 Human 做的真机检查条目：其 exit criterion 是 `docs/manual-checks.md` 中对应条目已写好、步骤可执行；真机检查本身由 Human 完成，不阻塞 phase（C1 范围内没有这类条目，M4、M7 才有）。
- **R1.1 – R1.8**：phase `release` 的 exit criteria，见下。

## Phases

| id | goal | exit criteria | depends | risk |
|---|---|---|---|---|
| M0 | 骨架：CLI 与 token、framed 传输、文件打开、Lanes 波形视图、播放、深色 dockview 布局、计算设备与 self-check | M0.1–M0.6、M0.C1–C3 | — | normal |
| arch | Specify H45 visible-region workspace export and the D43 masked PCM boundaries. | A1, the independently accepted DESIGN delta integrated and verified by A2 in `phase-arch.md`. | M0 | normal |
| M1 | 频谱视口、Display 与 presets、Frequency Analysis、T-F 选框与框内试听、`vsr.dsp` 基础 API、可见绘图区局部单页 PDF 导出、H54 工作台布局与视觉整改 | M1.1–M1.13、M1.C1–C3 | arch | high（DSP 标定、核心渲染与截图合成） |
| M2 | tensor 载入与 `vsr.show` 推送、feature lane、mel、`vsr.plot`、`vsr skill install`，feature 与 mel 视图复用工作台 PDF 导出 | M2.1–M2.6、M2.C1–C3 | M1 | normal |
| M3 | 编辑：波形编辑、T-F 选框删除 / 增益 / 提取、undo / redo、保存 | M3.1–M3.5、M3.C1–C3 | M1 | high（保存会改写用户文件） |
| release | Cycle integration and delivery: full regression, drift audit, docs, §17 measurements, version 0.1.0, CHANGELOG, release acceptance, install smoke, annotated tag push and conditional GitHub Release under H34–H36. | R1.1–R1.8 | M0–M3 | normal |

每个 milestone phase 的 phase plan 以一个 phase integration task 结束（合并、全量回归、`docs/acceptance/M<k>.md`）；task 与分支规则见 `LIFECYCLE.md` Integration。

## release phase 的 exit criteria

- **R1.1** 集成分支上，全部 check commands 通过（`LIFECYCLE.md` Checks），含 M0–M3 的验收测试；没有因环境缺失而改为跳过的项（DESIGN §20 的设备 `skipif` 不算，见 `LIFECYCLE.md` Checks），缺失项记 NOT RUN 并报告。
- **R1.2** drift audit 完成：按 `LIFECYCLE.md` 的 Drift map 双向比对 DESIGN 与代码，每个 finding 已修复、记为 §21 决定，或交 Scope gate；没有未处理的 finding。
- **R1.3** docs 同步：`LIFECYCLE.md` 的 Docs to sync 中属于 C1 范围的文档与代码一致（§21 的决定行、`CHANGELOG.md`）。
- **R1.4** 性能（D33、H27）：DESIGN §17 第 1–7 行在 run 所在的每个平台上、该平台可用的每个 `compute_device` 各测一次（3 次的中位数），数值写入 release 报告，并与同平台上一次的数值比较，回退写进 release 报告；release phase 的 integration task 在 squash 之后，在主工作树里把这次的测量行追加到 `docs/dev/performance.md`，不写在 task 或 phase 分支上（`LIFECYCLE.md` Checks 的 Performance budget）。§17 的数值是参考值，不作通过条件；没有为接近参考值而删减功能。
- **R1.5** 版本与记录：`pyproject.toml` 的版本为 0.1.0；`CHANGELOG.md` 有 0.1.0 一节；`docs/acceptance/release-0.1.0.md` 存在，含 M0–M3 各验收报告的结论、与 DESIGN 的偏离、未决项。
- **R1.6** install smoke 通过：从构建出的 wheel 在干净环境中安装并按 `LIFECYCLE.md` Delivery 的步骤运行，输出记入 release 报告。
- **R1.7** The integration branch's release commit has the annotated tag `v0.1.0` with message `Release 0.1.0`, and delivery follows LIFECYCLE Integration Push and Delivery under H34–H36.
  Each session's records commit and each milestone squash commit are followed by a `master` push to `origin`, and release delivery pushes the version tag without force-pushing or pushing task/phase branches.
  A GitHub Release is created when local `gh` is installed and authenticated, otherwise only the tag is pushed and the Release page is reported NOT RUN with the reason in the release acceptance report.
  PyPI uploads remain outside this run's authorized delivery, and the existing Delivery prerequisite for the Human's whole-tree and commit-metadata public-repository scan remains in force.
  Release, tag, commit, push and conditional Release-page outcomes and report paths are recorded in worklog and STATUS, and the Controller sends the milestone/release heads-up through the human channel.
- **R1.8** Protected content matches the baseline subject to the independently accepted H45 additions in DESIGN §§1 and 19, and the whole-tree public-repository scan under LIFECYCLE Checks has no findings.

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
| H34 standing authorization for automatic GitHub pushes. | Every milestone squash and session records commit under Integration Push, with release tag delivery in R1.7. |
| H35 GitHub Release creation is authorized and PyPI upload is deferred. | Release R1.7, retaining the separate package-index authorization boundary. |
| H36 use git until local `gh` is installed and authenticated. | Release R1.7 creates the Release page only when that prerequisite is available, otherwise records NOT RUN with its reason while pushing the tag. |
| H45 visible-region single-page PDF export (B3 and D40). | `arch` A1 and M1.13, with M2 feature and mel reuse. |
| H48 RIR coefficient and delay visualization (B4). | C3 M7 architecture and implementation. |
| H54 workspace visual and layout feedback. | M1-T4 DESIGN §9 repairs and desktop/narrow screenshot review, with final workspace evidence in T8. |

## Budget 估计

The M0 estimate is now explicitly 28 invocations, comprising 21 baseline seats and seven reserve seats, with Amendment A1 consuming one reserve invocation.
The combined `arch` and M1 estimate is 60 invocations as detailed in `phase-M1.md`, comprising 10 for arch and 50 for M1, and the provisional estimates of about 25 each for M2, M3 and release put C1 at about 163 invocations.
The M0 allocations and the CODEX review assignments remain recorded in the respective phase plans.
There is no declared paid-compute or external cost and no host-contract budget cap, while each phase retains the applicable estimate-overrun gate.

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
