# worklog — vsr 开发过程

run 的过程记录：周期与 phase 怎样拆分、task 怎样实现、核对结果、走不通的路线与自己的失误。最新条目写在本行下方，不改成正序，走不通的路线也不删除。

本文件进 git：Human 的原话以 H<n> 引用（原文在状态目录的 `human-inputs.md`），不写个人信息与机器信息（本机相关的内容写在状态目录的 `local.md`）。run 开始之前的设计与接入记录在本机状态目录的 `history/`，不在本仓库。

## 2026-11-17（run 开始之前：开发转到树莓派节点）

**按 H26、H33，开发节点从 Mac 转到树莓派（Raspberry Pi 5，aarch64，Linux）。代码经 GitHub 的 `origin`；状态目录按交接做法直接拷贝，附 kickoff 指令。run 尚未开始，状态为 `waiting-human`，由 Human 在树莓派上启动 Codex session 后接手。**

- 接入阶段的其余决定见 `decisions.md` D31–D34；push 与 GitHub Release 按 `LIFECYCLE.md` Integration 的 Push 规则（H34–H36）。
- 性能参考值（D33）：树莓派上第一次测量后写入 `docs/dev/performance.md`。

## 2026-11-17（run 开始之前：过程记录迁入 git）

**按 H24，把周期计划、backlog、decided 从状态目录移到 `docs/dev/`，本文件与 `decisions.md` 从这里开始（D28–D30）。run 还没有开始：状态为 `waiting-human`，等 Codex 一侧的 skill 移植（H21）与 Human 的启动（H22）。**

- 已有的记录：`cycles/C1/plan.md`（C1 = M0–M3 → 0.1.0）、`backlog.md`（B1、B2）、`decided.md`。
- 启动授权见状态目录的 `human-inputs.md`（H20 记为批准五项；host contract 一项待定）。
