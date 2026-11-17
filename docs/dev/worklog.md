# worklog — vsr 开发过程

run 的过程记录：周期与 phase 怎样拆分、task 怎样实现、核对结果、走不通的路线与自己的失误。最新条目写在本行下方，不改成正序，走不通的路线也不删除。

本文件进 git：Human 的原话以 H<n> 引用（原文在状态目录的 `human-inputs.md`），不写个人信息与机器信息（本机相关的内容写在状态目录的 `local.md`）。run 开始之前的设计与接入记录在本机状态目录的 `history/`，不在本仓库。

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
