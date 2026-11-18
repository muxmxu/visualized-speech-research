# worklog — vsr 开发过程

run 的过程记录：周期与 phase 怎样拆分、task 怎样实现、核对结果、走不通的路线与自己的失误。最新条目写在本行下方，不改成正序，走不通的路线也不删除。

本文件进 git：Human 的原话以 H<n> 引用（原文在状态目录的 `human-inputs.md`），不写个人信息与机器信息（本机相关的内容写在状态目录的 `local.md`）。run 开始之前的设计与接入记录在本机状态目录的 `history/`，不在本仓库。

## 2026-11-18 (C1 architecture and M1 planning)

M3 is delivered as `7cf8df9c5ee64abfbbdc9aa0b355190d1c8d5dc8` with 260 Python and 37 Vitest passes plus 75 distinct Chromium passes across the original run and the one targeted test-only selector repair, and main differs from the reviewed phase tree only in the A1 plan record.
M3-T2 passed real Chromium spectral delete, undo, redo and Save As, passed both independent reviews, and was committed at `570668b42c855dd83bcef05304dd528d84d6c228` with exact approved tree equality.
M3-T1 passed 27 selected edit and atomic save tests and independent review, was committed as `8c72a7c2adce767a8cc65132e4ac816d5a03f92d`, and was bound to the parallel T2 worktree without changing the frontend files.
M2 is delivered as `600152a00bfe6981c8d9ab0a28ba12cdc3830c42` after 233 Python, 37 Vitest and 74 Chromium passes on the integrated phase; exact blob and mode equivalence transfers that same evidence to master without duplicate runtime checks under H59.
M2-T5a verified cold and warm CLI Tensor opening through the real browser, passed 75 selected pytest, 37 Vitest and seven Chromium cases with independent review, and was committed locally as `4ad71c604d6a1a74a3293b9ce4b03c4668b87401`.
H59 directs first usable delivery through normal workflows with no optional defensive expansions or repeated checks, and this instruction applies to all remaining work.
M2-T5 passed both independent reviews on the frozen 14-case browser run and the D38 executor committed exactly the approved tree as `f997b75fdad271bfccddf1d433b29973ca348b99`.
The reviewed M2 CLI launch contract D49 was integrated as spec-only commit `f37ad73676e7248654e9c9c60b4f3a82ac117e39`, with only DESIGN §§7 and 21 changed and all 92 other non-record blobs identical to fully tested M1.
M2-T4's local show path now uses a direct loopback connection, passed exact authenticated PCM and zero proxy delivery regression with 84 selected tests and both independent reviews, and was committed locally as `9ed07af2cb0851d9777af735dd974718b132e832`.
M2-T4 passed 83 selected tests and independent audit, but semantic review reproduced default local routing through an environment proxy, so the Worker is correcting the loopback request path.
M2-T3 closed both semantic findings, passed 38 selected tests and two final independent reviews, and its four files were committed locally as `153cedca0c842d5a17c1f9b48fab09f255ab8a85`.
M2-T3's first static plotting and skill installer tree passed 30 selected tests and an independent audit, while semantic review reproduced forbidden palette acceptance and a bfloat16 waveform conversion failure for correction.
M2-T2 final integer-domain centering passed exact authenticated PCM red and green checks, 148 selected tests and independent reviews, and the approved seven files were committed locally as `dff75fbe4272d87d52627a20b0ea894ed10f2cd3`.
M2-T2 correction passed 146 selected tests and mechanical audit, but review 2 reproduced midpoint precision loss for uint32 and uint64, so the sole task amendment bounds final centering and same-rate PCM regressions.
M2-T2 passed its mechanical audit with 135 selected tests, while semantic review reproduced unsigned PCM offset, first partial pool timing, raw frame precision and dictionary key round-trip defects for correction.
M2-T1 passed the independent numerical and semantic reviews, verified CPU relative mel power error below 1.351e-6 and bitwise STFT preservation on the tested fixtures, and was committed locally as `84486e6ffd0209eee1d5b1e2357334f431f04a74`.
M2 phase planning and its sole Plan Review amendment are complete, including integer PCM verification for file loading and Python push, and shared mel DSP implementation started from delivered M1.
The independently reviewed M1 phase was squashed to master as `a4b37b680e3e14f0d07d244f94f79b349a471814`, with exact patch equivalence, every full master check exit zero, 119 Python passes, 36 device skips, 37 Vitest passes and 66 Chromium passes.
The M1 phase integration passed 119 Python, 37 Vitest and 66 final Chromium tests, recorded CPU benchmarks, and passed independent audit and semantic review before the required master regression.
M1-T7 corrected floating Play activation during the PDF gesture and removed the broad export catch, passed independent audit 3 and semantic review 2 with eight PDF Chromium and 37 Vitest cases, and was committed locally as `7b1cdd3b997d0315af7868915a9455c9cd233163`.
The M1-T7 browser run passed 64 of 65 cases, and the sole narrow screenshot failure reproduced with the same pixel values on accepted T6 because the Frequency Analysis dock clips the second spectrogram before the test samples it.
H57 resumed the run, and H58 prefers available 6.2 models for subsequent dispatches.
M1-T6 correction closed stale T-F ownership, idle E-tool hover and the missing ordinary-selection Play action, passed independent audit 2 with 35 Vitest and 27 Chromium cases plus semantic review 2, and was committed locally as `b419b77beeddcfedb00c3654506866c83a8a7d11`.
M1-T6's first T-F selection tree passed 35 Vitest and 23 Chromium cases and independent mechanical audit, but semantic review 1 reproduced stale audition ownership after lane closure, lost E-tool hover and a missing ordinary-selection floating Play action, so correction is active.
M1-T5 correction closed all three reproduced Frequency Analysis defects, passed independent audit 2 with 32 Vitest and nine Chromium cases and semantic review 2, and was committed locally as `20b42ec5e870a47035aa137e62540603a1709d77` by the D38 executor.
M1-T5's first frozen Frequency Analysis tree passed 31 Vitest and six Chromium cases and independent mechanical audit, but semantic review 1 reproduced display-only extra spectrum requests, stale curve relabeling and a valid Welch interval suppressed by frontend rounding, so correction is active.
M1-T4b correction closed all three semantic review 1 findings, passed independent audit 2 with 42 Chromium and 29 Vitest cases and semantic review 2, and was committed locally by the D38 executor as `b2babb0c9fc8bc8a639a51910581dafb30075131`.
M1-T4b's first frontend tree passed 40 Chromium and 29 Vitest cases and independent mechanical audit, but semantic review 1 reproduced narrow dock-label collapse, a 480 px toolbar overflow and an active-lane keyboard-test gap, so the Worker is correcting them before a task commit.
M1-T4a passed independent mechanical audit and semantic review on the frozen two-file tree, and the D38 executor committed it locally as `411e0cf9a65614d9a3374bb5a4a8b08ea025b170` without pushing the task branch.
The independent T4a check reproduced the old duplicate-source deletion 500, passed 119 Python tests and 40 Chromium tests on the final tree, and reported 12 high-severity npm audit findings for later triage.
H56 identified poor visual quality in the accepted M1 workspace screenshots, and the M1 plan now places a bounded DESIGN §9 presentation refinement after T4a and before Frequency Analysis.
The independent M1-T3 task plan fixes the absolute frame grid, bounded resampling support, whole-lane oracle, authenticated boundary cases, and four-path write set.
D45 records the exterior half-cosine mask profile and the invalid effective-window boundary, with T8 assigned the DESIGN §21 entry.
M1-T3 implementation was dispatched from reviewed M1-T2 commit `70d7f5c45e18b78777883bd1e6a2207704f6265f` in an isolated worktree.
The first top-level M1-T3 executor accepted its prompt but made no branch or file write for four minutes, so the Controller cancelled it and dispatched attempt 2 to an isolated Worker.
The M1-T4 task plan binds fourteen frontend files, H54 workspace repairs, real Chromium pixel and request checks, and 1280 × 720 and 800 × 600 screenshots with two selected spectral views.
M1-T3's first code attempt passed 103 Python tests with 36 device skips, and independent mechanical audit 1 passed on the same four-file tree.
Independent semantic review 1 failed with reproduced fractional-edge chunk dependence, an extreme finite time 500, and narrow Gaussian physical-edge precision drift.
The Controller returned those three cases to the T3 Worker for failing regressions and correction before any task Git commit.
M1-T3's corrected tree passed 106 Python tests and independent audit 2, while semantic review 2 closed all three prior issues and reproduced a finite chunk-bound overflow before lane clipping.
The T3 Task Planner appended the contract's sole task amendment for six extreme finite chunk bounds, preserving ordinary PCM and the prior numerical assertions.
The amended T3 tree passed 118 full Python tests, independent mechanical audit 3 and final focused semantic review 3 on the same four-file hashes.
Final review 3 independently reproduced 12 old-route overflow responses and verified 12 corrected ordinary and masked responses with exact frame metadata and zero nonempty sample error.
The review reconstructed the prior test file hash after removing only the appended regression and its import, confirming that prior assertions were preserved.
The independent D38 Git executor committed the accepted M1-T3 four-file task tree as `9cb96340880a521f5bba7c0354704db3e8735b34` without pushing the task branch.
M1-T4 implementation was dispatched from that reviewed commit with H54's visual repairs and meaningful desktop and narrow browser captures in scope.
The T4 Planner corrected one arithmetic auto80 example from [−100,−20] to [−90,−10] for lane maximum −12.25 dB, preserving the DESIGN formula and other plan content.
The M1-T7 PDF task plan binds both visible plot surfaces, device-pixel cropping, independent JPEG and PDF parsing, full Chromium reader smoke and unchanged selection and network state, with dependency facts to bind after T4–T6.
During T4 browser regression a duplicate-source second-lane deletion returned HTTP 500 because list removal compared Tensor-bearing dataclasses, and the Overall Planner inserted the regression-first two-file T4a backend fix before T5 without changing M1 acceptance.
The first T4 frontend tree passed 29 Vitest and 32 Chromium tests and independent mechanical audit 1, with desktop and narrow screenshots, but semantic review 1 reproduced seven in-scope viewport, texture, hover, layout and cross-rate defects.
The Controller returned all seven review-1 findings to the T4 Worker for regression-first correction before any task Git commit.
M1-T4 correction 1 passed 29 Vitest and 40 real Chromium tests, including eight new review regressions, and independent mechanical audit 2 passed on the frozen twelve-file tree.
Independent semantic review 2 repeated all seven prior browser findings and passed, with the one HTTP notification REVIEW allowed as V1#1.
The two updated desktop and narrow screenshots were inspected directly, while the previous untracked browser test bytes were unavailable for bytewise comparison.
The independent D38 executor committed the accepted T4 twelve-file tree as `fc3d13df6d561b6508c67c12536beca3bcf2c1e7` without pushing the task branch.
The focused T4a backend Worker was dispatched from that commit for regression-first duplicate-source lane deletion repair before T5.
M1-T2's amended tree passed final independent audit 3 and semantic review 3 with 65 tests, two allowed device-skip REVIEW lines and a cold peak RSS below 1.5 GiB.
The reviewed M1-T2 task branch commit is `70d7f5c45e18b78777883bd1e6a2207704f6265f`, and M1-T3 planning follows it.
An independent warm-cache diagnostic observed 0.102 and 1.966 seconds for 256-row and 1024-row log viewport requests, respectively; T8 retains the formal browser performance measurement.
M1-T2's first implementation passed 53 targeted tests and a 1.234 GiB cold peak-RSS gate, but semantic review 1 found four log, empty-frame, memory and internal exception defects.
The Worker repaired those findings, and independent audit 2 passed 60 tests with a 1.235 GiB cold peak RSS and no internal exception REVIEW.
Semantic review 2 reproduced two remaining log-boundary defects, so the T2 task planner added the sole task amendment for representable minimum frequency and unbracketed empty bands.
The independent M1-T2 task plan bound the five-path write set, absolute-grid and cache oracles, and the cold ten-minute peak-RSS gate before Worker dispatch.
M1-T1's sole task amendment produced four failing zero-power Welch PSD regressions on the previous tree and 51 passing targeted tests after the repair.
Final independent audit 3 and semantic review 3 passed, with the two conditional device skip REVIEW lines allowed.
The reviewed M1-T1 task branch commit is `eb1e595e43538a6719cc29a73c25f5c39a965b3c`, and M1-T2 planning follows that dependency.
M1-T1's first implementation passed 37 targeted tests but semantic review 1 found twelve numerical, boundary, metadata, and admission defects.
The Worker added regressions that failed on the prior implementation and repaired those findings; audit 2 passed 47 tests with device-availability skips.
Semantic review 2 closed eleven findings and reproduced NaN percentile rows for all-zero Welch PSD, so the phase plan author added the sole T1 task amendment for exact zero-power and mixed-power dB-domain quantiles.
D44 records explicit rejection of a full-spectrum interval beyond the stated 2^24 FFT cap instead of silent sample truncation.
A2 froze the reviewed A1 DESIGN change in phase/arch, and independent phase audit and semantic review passed before the master squash.
The phase and new master each passed 35 pytest tests, 18 Vitest tests, 19 one-worker Chromium tests, dependency installation, Ruff, typecheck, lint, and build.
The new master architecture commit is `00fea16c7cbc17da95b82ffd95db467132fa756c`, and its DESIGN diff is byte-identical to the reviewed phase diff.
The architecture commit was pushed, and M1 implementation may start from that baseline.
A1's first mechanical audit passed, but semantic review 1 found that PDF capture omitted the visible Frequency Analysis plot, a DPR-dependent crop edge differed by one pixel, and masked FFT/window validation was incomplete.
The A1 Worker repaired those three findings, and independent audit 2 and semantic review 2 passed on the same DESIGN diff with no rule REVIEW entries.
H45 adds a visible-workspace crop exported as a single-page raster PDF, and the M1 reconnaissance verified browser WebGL2 and a synthetic downloadable PDF that an independent reader opened.
The independent architecture Plan Review found one integration-order defect, and the independent M1 Plan Review found four task-contract and verification defects.
The Overall Planner completed the contract's single amendment before architecture dispatch, including D43's masked PCM selection bounds and H54's UI repair criteria.
H54's UI consultation identified uneven control grouping, numeric alignment, view focus, and playhead color, with desktop and narrow-browser checks assigned to M1.
H39's Codex skill merchant update was committed and pushed independently at version 1.5.1+codex after structure, script, and public-content checks.

## 2026-11-18 (M0 integration and acceptance)

M0 was integrated from the five reviewed task branches, and the final main code commit is `99286649b43569fea9153c9a5ecd6753886f4377`.
The phase and main final trees each passed 35 pytest tests, 18 Vitest tests, and 19 one-worker Chromium tests, together with the required dependency, type, lint, and build checks.
The real-browser zero-width playback regression was RED before repair and GREEN afterward, and final mechanical audit 2 and semantic review 2 passed.
The first CPU benchmark recorded 4.173, 4.188, and 3.721 seconds for a generated ten-minute stereo WAV, with a 4.173-second median and no prior same-platform value.
The M0 code commit was pushed, and the next lifecycle step is M1 planning and architecture with H45's visible-region PDF export.

## 2026-11-17 (M0-T5 amendment A3)

M0-T5 passed final independent mechanical audit 7 and semantic review 3 on the same five-file tree, including all 11 browser playback tests and V1#1 dispositions for two request-boundary catches.
The reviewed task branch commit is `9daf47dbd0d20668a355d55360e02f9f8d2318cf`, and M0-T6 integration is next.

Amendment A3 was added under T5 after its two consecutive semantic-review FAILs, requiring real-backend initial-PCM and asynchronous-restart failure cleanup and single-click recovery regressions while preserving prior acceptance requirements.
Independent mechanical audit must pass before one final focused semantic review, and any further semantic FAIL after A3 blocks T5 with no further rework, task amendment or task-level consultant.

## 2026-11-17 (M0-T4 waveform workspace)

**The waveform workspace passed final independent audit and semantic review, and task branch commit `000c608d3f7cc8330c7523242fe7cc4f3908cd00` contains its implementation and browser tests.**

- Initial browser coverage passed but omitted continuous viewport request cadence, cached redraw, several interactions, and a complete readiness fixture; audit-1 failed and targeted tests failed on the old code before the repair.
- Review-1 reproduced inverted selection, duplicate sample-level ruler labels, and unauthorized fixture readiness catches; browser regressions failed on the old code before the repair.
- Audit-3 reproduced a cleanup hang for a signal-exited child; its regression failed before the cleanup repair, and audit-4 passed afterward.
- Amendment A2 added the required zero-width resize and recovery regression after two consecutive semantic-review failures, preserving the existing task scope and tests.
- Review-2 reproduced a zero-width ruler crash; the final browser regression failed before the repair, then audit-5 and review-3 passed.
- Final checks passed: frontend typecheck, 7 unit tests, lint, build, 7 real-backend Playwright tests, and rule check with `0 FAIL, 3 REVIEW`, all three dispositioned `V1#1`.
- H48 added B4 for RIR coefficient-versus-delay visualization and direct/subsequent arrival readouts in M7.

## 2026-11-17 (M0-T3 authenticated audio backend)

**The T3 backend passed independent mechanical audit and semantic review, and its task branch was committed as `49303ebd4e479d459629613aa6ca206d0a9c27c5`.**

- The first audit found missing WebSocket absent-token and HTTP 500 traceback assertions; the Worker added focused tests and audit-2 passed.
- The first semantic review reproduced three defects: ignored CLI device override on a running server, non-finite lane metadata corrupting session responses, and NaN self-check metrics passing device selection.
- Regression tests failed on the prior implementation with 14 failures; the Worker fixed the three behaviors and non-finite time-query validation at HTTP entry.
- The final task suite passed 30 tests, Ruff and rule checks passed, audit-3 and review-2 passed, and an independent Git worker completed the task commit after `impl check`.

## 2026-11-17（M0-T2 framed 传输）

**Python 与 TypeScript 的 framed codec 和双向互操作测试已通过独立审核，task 分支提交为 `40e9400829125267a1b079cd9704648291198caf`。**

- 首轮机械审计通过：Python 5 项、前端 6 项、typecheck、lint 与规则检查通过。首轮语义审查发现 f32 signaling-NaN 的位模式经 JavaScript 数值转换后被改写，结论 FAIL；原报告保留。
- Worker 先加回归测试，在旧代码上复现 4 项失败，再修成按原始整数位读写。复核后前端 10 项通过，第二轮机械审计和语义复审均 PASS；规则检查为 `0 FAIL, 0 REVIEW`。
- 独立顶层执行会话做 `impl check`，只提交 T2 的五个文件，没有提交生成产物、推送或合并任务分支。

## 2026-11-17（M0 实施启动）

**按 H38–H46 持续推进；M0-T1 首轮机械审计 FAIL，H43 授权最小修正后第二轮机械审计 PASS，语义审查进行中。**

- 环境验证见 `cycles/C1/reports/preflight-M0.md`：临时 Python 与前端依赖可安装，回环端口可用；浏览器与最终应用测试尚未验证。
- preflight 首次 npm 安装误写了接手前未跟踪的根包文件并生成依赖目录；执行者发现后停止，清理由其创建的目录，并依接手记录重建根文件。原始字节未备份，不能声称逐字节恢复。
- 另以独立顶层执行进程验证了 Worker 通道；task 分支提交与最终整合的角色分工交 consultant 核定。T1 实现、核验尚在进行。
- T1 的 Python import、`ruff check`、前端 typecheck/lint/build 通过；Mechanical Audit 报 `check_diff_rules.py` C5 FAIL 与 `ruff format --check` 对两份保护文档的 FAIL，见 `cycles/C1/reports/M0-T1-audit-1.md`。未派 Task Reviewer，也未提交该 task 分支。
- consultant 确认须走 Rules gate；最小修正案已向 Human 提出，答复未到前不改保护配置。独立浏览器预检在临时目录验证 Chromium 与 Web Audio 可用，见 `cycles/C1/reports/browser-preflight-M0.md`。
- H43 明确授权必要的配置修正，Astra 核对后按 D39 同步源配置和 T1 实际配置；第二轮机械审计通过，原 FAIL 保留。H45 的局部 PDF 导出需求已记为 B3、D40，安排 M1；H44、H46 要求持续推进核心功能，不把技术细节反复交给 Human。
- T1 语义审查首轮 FAIL：两套前端测试会互相收集文件，torch CPU 来源被无条件应用到其他平台。按 D41 返工后，第三轮 Mechanical Audit 与第二轮 Task Review 均 PASS；独立顶层执行会话完成 `impl check`，只提交 T1 交付文件至 task 分支 `5c624e5d3e10c9064e8dcd653f36405992f5f903`。T1 没有单元测试或 e2e，未将它们标为通过；M0 整体验收仍待后续 task。

## 2026-11-17（M0 phase plan 启动）

**按 H38–H41 接手并启动交互式 long-term run；M0 phase plan 已写，独立 Plan Review 判 FAIL 后完成唯一一次 Amendment A1。**

- Codex long-term skill 已可用；基线与仓库身份核对通过，接手时已有两个未跟踪的包配置文件，先保留并核查。
- `.gitignore` 已单独提交；编排契约使用仓库根的本地副本，未入 git。
- Plan Review 的两项 finding 是周期交付条件的旧措辞和缺少独立 recon；原 FAIL 保留在 `cycles/C1/reports/plan-review-M0.md`，recon 见 `cycles/C1/reports/recon-M0.md`，修订见两个 C1 计划文件（D35）。
- M0 计划覆盖 6 项验收与 3 项共同标准；环境兼容、浏览器可用性和独立 git 执行通道仍须在受影响 task 派发前验证。

## 2026-11-17（run 开始之前：开发转到树莓派节点）

**按 H26、H33，开发节点从 Mac 转到树莓派（Raspberry Pi 5，aarch64，Linux）。代码经 GitHub 的 `origin`；状态目录按交接做法直接拷贝，附 kickoff 指令。run 尚未开始，状态为 `waiting-human`，由 Human 在树莓派上启动 Codex session 后接手。**

- 接入阶段的其余决定见 `decisions.md` D31–D34；push 与 GitHub Release 按 `LIFECYCLE.md` Integration 的 Push 规则（H34–H36）。
- 性能参考值（D33）：树莓派上第一次测量后写入 `docs/dev/performance.md`。

## 2026-11-17（run 开始之前：过程记录迁入 git）

**按 H24，把周期计划、backlog、decided 从状态目录移到 `docs/dev/`，本文件与 `decisions.md` 从这里开始（D28–D30）。run 还没有开始：状态为 `waiting-human`，等 Codex 一侧的 skill 移植（H21）与 Human 的启动（H22）。**

- 已有的记录：`cycles/C1/plan.md`（C1 = M0–M3 → 0.1.0）、`backlog.md`（B1、B2）、`decided.md`。
- 启动授权见状态目录的 `human-inputs.md`（H20 记为批准五项；host contract 一项待定）。
