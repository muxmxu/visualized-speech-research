# decisions — vsr 开发过程

run 中作出的决策：每条写决策、依据、如何回退，标注作出者。只追加。涉及产品的决策标「涉及产品」，由该决定所属分支线上的下一个 integration task 追加到 `docs/DESIGN.md` §21（一行，编号相同），controller 不在主工作树编辑 DESIGN（D34）。

D1–D27 是 run 开始之前（设计与接入阶段）的决策，记录在本机的状态目录，不在本仓库；其中与产品有关的内容已写进 `docs/DESIGN.md`，与过程有关的已写进 `LIFECYCLE.md`。本文件从 D28 开始。

本目录（`docs/dev/`）进 git，可能共享或公开：不写个人信息与机器信息；Human 的原话只在状态目录的 `human-inputs.md`，这里以 H<n> 引用。

## 2026-11-17（决策型 Controller，接入阶段的最后调整）

- **D28 开发过程的记录进 git，本机状态留在 git 之外（H24）。** `docs/dev/`（受跟踪）放 run 的 worklog、本文件、`backlog.md`、`decided.md`、`cycles/`（周期计划、phase plan、audit 与 review 报告）。状态目录（不进 git）只放 STATUS、HANDOFF、`human-inputs.md`、`INBOX.md`、STOP、driver 的 lock 与 log、`tmp/`（含 worktree），以及本机特化的 `local.md`。依据：H24。回退：把 `docs/dev/` 下的文件移回状态目录，`LIFECYCLE.md`「State and records」改回单一状态目录。
- **D29 记录每一步提交一次，主工作树固定在集成分支。** 每个 session 结束前，主 session 只 stage `docs/dev/`，在集成分支上提交，message 为 `records: <step>`；代码仍按 milestone 一个 squash commit。为此主工作树不再切换分支：所有 task 分支与 phase 分支都放在状态目录 `tmp/worktrees/` 下的 worktree 里。依据：记录在 milestone 之间也受 git 保护；主工作树不切分支，未提交的记录就不会随分支切换出现冲突。代价：`master` 上有许多 `records:` 提交，`git log -- src frontend` 仍只显示 milestone。回退：改为在 phase integration 时把记录并入 milestone commit。
- **D30 `docs/dev/` 可以写角色与模型档位名，仍不写个人与机器信息。** 依据：编排契约要求 phase plan 写明每个 task 的 Worker 与核对席位的模型和 effort；档位名不是个人或机器信息。每次 `records:` 提交之前，用 host contract 的个人与机器词表检索 staged diff，命中的内容移到状态目录的 `local.md` 或 `human-inputs.md`。产品代码与产品文档仍不写档位名（`LIFECYCLE.md` Checks）。回退：改为 plan 只写角色、档位留在状态目录。

## 2026-11-17（决策型 Controller，接入阶段：迁往树莓派与多平台）

- **D31 code agent 的节点搬迁复用 RA 侧的工具与节点契约，不另写一套（H29）。** vsr 在节点之间搬迁时，与 RA 使用同一份节点契约与同一个同步工具，按项目配置；代码仓库的中心是 GitHub（H28），状态目录作为独立仓库同步，中心在私有的 git 中心。依据：H29 要求搬迁逻辑与 RA 侧一致。回退：为 code agent 另写独立的搬迁脚本。
- **D32 迁移之前的准备分三步串行或并行进行：skill 改名与修复先行；节点搬迁 skill 与 vsr 多平台支持随后并行；最后执行迁移。** 依据：两者改动的文件不相交，都依赖改名后的 skill 文本。回退：全部串行。
- **D33 性能参考值按平台记录，不作通过条件（H27）。** DESIGN §17 现有数值作为 M 系列 Mac 的参考；其他平台（含 Raspberry Pi 5 cpu）的参考值在该平台首次测量后记在 `docs/dev/performance.md`；run 在其运行的每个平台上测量，与同平台上一次比较，回退写进验收报告。依据：H27；其他平台的数值事先无从得知。涉及产品。回退：由 Human 给出各平台数值写进 §17。
- **D34 controller 的决定只写本文件，不在主工作树编辑 `docs/DESIGN.md`。** 涉及产品的决定标「涉及产品」；controller 派发该分支线上（主线或 hotfix 周期）的下一个 integration task 时列出这些编号，由该 task 在其 worktree 中追加到 §21，随 squash 或合并进入 `master`。task 与 reviewer 在 §21 追加之前引用 D<n> 时，以本文件为准。task 自己的补充决定仍由 task 在其分支追加到 §21。依据：主工作树固定在 `master`（D29），controller 若在那里改 DESIGN，之后的 `git merge --squash` 会因本地改动中止（review-TaskB-2 在临时仓库中复现）。回退：改为 controller 在主工作树写 §21 并在 integration 之前单独提交它。

## 2026-11-17（M0 计划复核后的修订）

- **D35 按现行交付授权修订 C1 周期计划，M0 计划绑定独立 recon。** M0 的首次 Plan Review 结论为 FAIL，指出 R1.7 的旧禁止 push 语句与 H34–H36、LIFECYCLE 的 Push 规则相冲突，且初稿缺少独立 recon 输入。Overall Planner 只作一次 Amendment A1：R1.7 改为按已有授权 push 与条件性创建 GitHub Release；recon 的事实写入 M0 phase plan，未验证的环境与执行通道保留为派发阻塞。依据：`cycles/C1/reports/plan-review-M0.md` 与 `recon-M0.md`。此决定不改变产品范围，也不增添新的发布授权。回退：如既有授权变化，按新的 Human 输入重新修订交付标准。

