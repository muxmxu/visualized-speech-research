<!-- runbook-contract: lifecycle v1 -->
# Lifecycle

<!-- vsr 长周期 run 的项目文档。long-term skill 按下列 H2 标题的原文定位，不要改名。
     本文件进 git，可能在研究室共享或公开到 GitHub：不写个人信息与机器信息（家目录路径、
     用户名与主机名、模型档位、agent 命令行、通知工具），这些属于 host contract（用户级契约目录，
     不在本仓库）。human-owned：agent 只提议修改，不直接编辑。值为 TODO 时，需要它的阶段会停下。 -->

## Sources

- Requirements：`docs/DESIGN.md` 的 §0（定位与原则）、§1（范围，含「v1 不做」）与 §19 各 milestone 的验收清单是产品需求，human-owned。Human 的原始要求逐字记录在状态目录的 `human-inputs.md`（不进 git）。DESIGN 经 Human 在启动时批准后成为本 run 的需求文档，批准记在 `human-inputs.md`。
- Spec：`docs/DESIGN.md`，唯一事实源（功能范围、技术栈、接口、DSP 定义、验收标准）。agent 可以编辑：§21（实现中的补充决定，只追加）；在 `arch` phase 中，可对 §2–§15、§18、§20 写入 spec delta，每个 delta 同时在 §21 记一条决定。不可编辑：见 Protected standards。触及不可编辑部分的改动写成提案，走 Scope gate。
- System scope：见 DESIGN §0、§2、§3、§4。vsr 是本地运行的音频分析工作台；用户是在自己的机器、或经 SSH 隧道访问自己服务器的 speech / acoustics 研究者，也包括调用 `vsr.show()` 的训练脚本（§2）。信任边界：HTTP / WS 入口（只绑 127.0.0.1，token 校验）、用户打开的文件与 tensor（`weights_only=True`、`allow_pickle=False`）、用户自己的 analyzer 插件（用户的 Python 代码，按用户权限运行，§12）、用户的数据集目录（只读）。范围内：数值正确（§8、§14 的定义与 §19 的数值验收）；用户文件与录音不丢、不被未经显式保存地改写（§4、§11、§15）；§4 的安全项；损坏或异常的输入在边界处报错，server 继续服务。范围外（reviewer 的发现记入 backlog，不在 task 内修）：多用户与 §4 之外的远程攻击者、analyzer 插件的沙箱、针对第三方解码库的恶意构造文件、§1「v1 不做」的功能、各平台的性能与 §17 参考值的差距（性能只测量并记录，不是通过条件，见 Checks 的 Performance budget）。
- Protected standards：下列由 Human 修改，agent 只提议。
  - `AGENTS.md`（开发规则文档）、本文件、linter 与类型检查配置（`pyproject.toml` 中的 `[tool.ruff*]` 表、`frontend/eslint.config.js`、`frontend/tsconfig.json` 的 strict 相关项、vitest 与 Playwright 配置中禁用 `only` 的项）、规则检查脚本 `scripts/check_diff_rules.py`。
  - `src/vsr/skills/vsr-speech-visualization/`（配套 skill 与 `presets.toml`）：实现跟随它，不反过来。
  - `docs/DESIGN.md` 的 §0、§1、§16、§17、§19：原则、范围、公共 API 与配套 skill、性能参考值、各 milestone 的验收清单。
- Roadmap：`docs/DESIGN.md` §19 的 M0–M7，每个 milestone 一份验收清单。Exit criterion 编号 `M<k>.<i>`：M<k> 清单的第 i 条，按出现顺序从 1 起。每个 milestone phase 另有三条共同的 exit criteria：`M<k>.C1` 全部 check commands 通过（见 Checks）；`M<k>.C2` `docs/acceptance/M<k>.md` 写明每条 exit criterion 的结果与证据；`M<k>.C3` 实现中的补充决定已记入 DESIGN §21，保护区未被改动。§19 中写给 Human 做的真机检查（`docs/manual-checks.md` 的条目），其 exit criterion 是：条目已写好、步骤可执行；检查由 Human 完成，不阻塞 phase。
  - 发布周期：C1 = M0–M3 → 0.1.0；C2 = M4–M5 → 0.2.0；C3 = M6–M7 → 0.3.0。
  - milestone 按 M0 → M7 串行（AGENTS.md「工作方式」）：上一个 milestone 的验收清单全部通过后才开始下一个；周期按 C1 → C3 的顺序，上一个周期的 release 交付后才开始下一个周期的计划。

## State and records

- State directory：`agent_workspace/2026-11-16-autonomous-dev/`，不进 git（`.gitignore` 列有 `agent_workspace/`），只放与这台机器有关、或可能含个人信息的内容：`STATUS.md`、`HANDOFF.md`、`human-inputs.md`（Human 的原话，仓库可能共享或公开，所以保持不跟踪）、`INBOX.md`、`STOP`、`driver.lock`、`driver.log`、`tmp/`（worktree 与临时文件）、`local.md`（本机特化的指令，以及任何含个人或机器信息的内容）。`history/` 是 run 之前的私有记录（D1–D27 与早期 worklog），只读，不再追加。状态目录不是备份：需要长期保留的结论写进 `docs/dev/`、`docs/acceptance/`、DESIGN §21 或 `CHANGELOG.md`。
- Records directory：`docs/dev/`，进 git。放 run 的过程记录：`worklog.md`、`decisions.md`、`backlog.md`、`decided.md`、`performance.md`（DESIGN §17 的各平台数值，见 Checks 的 Performance budget）、`cycles/C<n>/`（周期计划、phase plan、`reports/`、`hotfix-<k>/`）。记录以 H<n> 引用 Human 的输入，不抄原话。可以写角色与模型档位名，不写个人与机器信息。
- Records commit：每个 session 结束前，只 stage `docs/dev/`，在 `master` 上提交，message 为 `records: <step>`。提交前，用 host contract 的个人与机器词表（`grep -nwF`）和通用模式（家目录路径、邮箱、非回环的 IP 地址）检索 staged diff，命中的内容移到状态目录的 `local.md` 或 `human-inputs.md`，再重新 stage。这是本地 commit，受 Commit authorization gate 约束：授权记录之前，记录只写不提交。`docs/DESIGN.md` 不在 stage 范围内：controller 不在主工作树编辑它，主工作树里它始终与 `master` 一致，否则之后的 `git merge --squash` 与 hotfix 合并回 `master` 会因本地改动而中止。
- Decision record：`docs/DESIGN.md` §21。每条一行，以 `D<n>` 起头，然后是日期、决定、理由。编号与 `docs/dev/decisions.md` 是同一个序列，该文件保留完整的依据与回退。controller 的决定只写 `docs/dev/decisions.md`；其中涉及产品的，由下一个 integration task（phase 或 hotfix 周期）在它的 worktree 里追加到 §21，随 squash 或合并进入 `master`。task 自己的补充决定仍由该 task 在其分支追加到 §21。

## Checks

- Rules doc：`AGENTS.md` 的「开发规则（lifecycle v1）」一节（human-owned）。
- Check commands：全量回归，在仓库根按 AGENTS.md「命令」一节的顺序，对最终树运行；命令原文以该节为准（M0 建立，human-owned），这里不复制，以免两处分叉。每条命令 exit 0 即通过：Python 的测试与 `ruff check` / `ruff format --check`；前端的 `typecheck`、单元测试、`build`；`playwright test` 的 e2e。另外：
  - e2e 需要联网安装依赖、在 127.0.0.1 开端口、Chromium：Playwright 的（`npx playwright install chromium`）；该平台没有可用的 Playwright Chromium 时，用 host contract 指定的可执行文件，经环境变量 `VSR_E2E_CHROMIUM` 传入（DESIGN §20）。缺任何一项，该项记 NOT RUN 并报告，不改成跳过。DESIGN §20 规定的、按设备是否可用的 `skipif`（mps、cuda、录音 / 播放设备）不在此列：被跳过的测试及其 `reason` 列入验收报告，验收项按它自己的措辞判定。没有点名具体设备的项只计该平台上可用的设备（DESIGN §4 与 §19 M1.5 的「本机所有可用设备」，§19 M0.6 的设备切换）；只有项本身要求缺失设备才能验证的，才记为未验证，并写明该平台没有该设备。
  - 保护区检查：`git diff --stat <base> -- AGENTS.md LIFECYCLE.md src/vsr/skills/ scripts/check_diff_rules.py` 无输出；`pyproject.toml` 与前端配置的 diff 不触及 Protected standards 所列的 linter、类型检查与禁用 `only` 的项。
  - DESIGN 保护区检查：逐章比较 `<base>`（取法同 Rule check）与工作树的 `docs/DESIGN.md`，章节以 `## <n>.` 标题划分。在仓库根运行，以输出判定：

    ```sh
    base=<base>
    old() { git show "${base}:docs/DESIGN.md"; }
    sec() { awk -v n="$1" '/^## /{p=($2==(n "."))} p'; }
    for n in $(seq 0 21); do
      [ "$(old | sec "$n")" = "$(sec "$n" < docs/DESIGN.md)" ] || echo "changed: DESIGN §$n"
    done
    [ "$(old | grep '^## ')" = "$(grep '^## ' docs/DESIGN.md)" ] || echo "changed: DESIGN section headings"
    [ "$(old | sed '/^## /,$d')" = "$(sed '/^## /,$d' docs/DESIGN.md)" ] || echo "changed: DESIGN preamble"
    old | sec 21 | diff - docs/DESIGN.md | grep '^<' && echo "edited: DESIGN §21 existing lines"
    ```

    允许出现的输出：非 `arch` phase 只有 `changed: DESIGN §21`；`arch` phase 另可有 §2–§15、§18、§20 的 `changed` 行。其余任何输出都是 finding：触及前言（preamble）、§0、§1、§16、§17、§19 的改动写成提案，走 Scope gate；非 `arch` phase 触及 §2–§15、§18、§20 的，改记为 §21 的一条决定，确需 spec delta 的，作 amendment 增加 `arch` phase。
  - DESIGN §16 公共 API 的签名逐个对照（`inspect.signature`），§18 的文件路径存在。
  - 公共仓库扫描：task diff 的新增行不含个人信息与机器信息，包括任何系统的家目录绝对路径、用户名与主机名、邮箱、非回环的 IP 地址、agent 命令行、通知工具名、私有仓库名；模型档位名只在 `docs/dev/` 可以出现，其他受跟踪文件不得有。`docs/dev/` 可有角色与档位名，不得有个人与机器信息，并在每次 `records:` 提交之前按 State and records 的 Records commit 检索。Auditor 通读 diff；host contract 提供词表时，再用该词表逐词检索，词表只用于检索，不写入任何受跟踪文件。有命中即为 finding。
- Rule check：`python3 scripts/check_diff_rules.py --base <base ref>`，对每个 task 的 diff 运行：task 分支与 phase integration 的 base 都取分支切出时的 commit（`git merge-base <切出时的 ref> HEAD`，例如 `git merge-base master HEAD`），而不是 `master` 本身，因为之后 `master` 上有 `records:` 提交，直接用它会把这些记录算进 diff（已有 disposition 的 REVIEW 行沿用，只处理新增的行）。FAIL 阻断合并；每条 REVIEW 由 Task Reviewer 在 review 报告中给出 disposition。该脚本是 long-term skill 的 `check_diff_rules.py` 的逐字节副本，human-owned。
- Performance budget：DESIGN §17 的参考值，不作通过条件（D33）。表中的数值是 M 系列 Mac 的参考值；其他平台的参考值在该平台首次测量后记入 `docs/dev/performance.md`，不写进 DESIGN。run 在其运行的每个平台上测量：该平台可用的每个 `compute_device` 各测一次（Raspberry Pi 5 上为 cpu），每项取 3 次的中位数，与该文件中同平台、同设备的上一次数值比较，回退写进验收报告；没有上一次数值时，M 系列 Mac 与 §17 的数值比较，其他平台把这次测量记为该平台的参考值。该文件按平台分节，每次测量一行：日期、commit、设备、§17 第 1–7 行的中位数；平台名写机型或芯片、架构与操作系统，不写主机名与路径。该文件是记录（State and records）：只由各 phase（含 release phase）的 integration task 在 squash 之后写，在主工作树里追加这个 phase 的测量行（没有该文件时创建），上一次数值也从主工作树里的该文件读取；不写在 task 或 phase 分支上，否则它会进入 squash commit，或与主工作树里的未提交改动重叠而使 `git merge --squash` 中止（Integration 的 Branch policy）；它随 `records:` 提交进入 git。基准脚本在 `tests/bench/`（M0–M2 建立）：M0 测量第 1 行，M1 测量第 2–6 行，M2 测量第 7 行；release phase 全部重测，并另与同平台、同设备上一个 release 的数值比较。没有达到参考值不阻塞验收：报告实测值与瓶颈，不通过删减功能来接近参考值（DESIGN §17）。

## Integration

- Branch policy：
  - 集成分支：`master`（仓库现有分支，不改名）。
  - 主工作树固定在 `master`，不切换分支：记录写在其中，在其上提交（State and records 的 Records commit）。所有 task 与 phase 分支各用一个 git worktree，放在 `<state dir>/tmp/worktrees/<分支名>`；worktree 可丢弃，分支才是持久的。
  - task 分支 `task/<phase>-<task id>`（`task/M1-T3`），从集成分支的 tip 切出；依赖另一个 task 的 task，从该 task 的分支切出（该 task 已通过审核）。
  - 合并只发生在 phase integration：该 task 的 Worker 是最终树的唯一 writer，从集成分支切出 `phase/<id>`（`phase/M1`、`phase/release-0.1.0`），按依赖顺序，把每个已通过独立审核的 task 分支用 `git merge --no-ff` 合并进来（一个 task 一个 merge commit），解决跨 task 冲突，在 phase worktree 中对 phase 树跑全量检查；通过后在主工作树对 `master` 做 `git merge --squash`，一个 commit，只提交 squash 的内容（不带 `-a`，记录不进这个 commit，由 `records:` 提交另行保存），message 形如 `M1: spectrogram viewport and frequency analysis`（AGENTS.md「Git」；release phase 为 `Release <version>`），再在主工作树上跑一次全量检查。controller 不合并。commit、merge、tag 以记录的授权为准；不 push。
  - hotfix 分支 `hotfix/<version>`，从最新 release tag 切出，不从集成分支切出（patch 不带未交付的改动），同样放在 `<state dir>/tmp/worktrees/hotfix/<version>` 的 worktree 中。hotfix 周期里它代替集成分支：该周期的 task 与 phase 分支从它切出，按上一条合并回它（phase 分支在 hotfix 的 worktree 中用 squash）；Checks 与 Delivery 里的「集成分支」都指它，patch 的 release commit 与 tag 也在它上面。该周期的记录仍写在主工作树，在 `master` 上提交 `records:`。patch 交付后，在主工作树以 `git merge --no-ff`（merge commit）把它合并回 `master`，冲突由 integration task 解决并重跑全量检查。
  - commit message 用英文，不加入任何 AI 署名（AGENTS.md「Git」）。
- Push：常设授权 H34–H36。每个 session 的 `records:` 提交之后、每个 milestone 的 squash commit 之后，把 `master` push 到 `origin`；release 交付时 push 版本 tag；不 force push；task 与 phase 分支不 push（只存在于 worktree）。GitHub Release：release 交付时由 run 创建，前提是本机已登录 `gh`；否则只 push tag，并在 release 验收报告里把 Release 页面记为 NOT RUN 并写明原因（H36）。包索引（PyPI）上传：暂不做，需要时由 Human 决定（H35）。
- Drift map：spec 章节对应的代码，路径取自 DESIGN §18。审计是双向的：DESIGN 有而代码没有、代码有而 DESIGN 没有，都是 finding。
  - §4 → `src/vsr/cli.py`、`config.py`、`device.py`、`server/app.py`；§5 → `server/session.py`；§6 → `frame.py` 与前端 `frame.ts`
  - §7 → `server/routes_*.py`（路由表对照 §7 的列表）；§8、§14 → `dsp/` 下的 `stft.py`、`spectrum.py`、`mel.py`、`waveform.py`、`rir.py`、`sweep.py`
  - §9 → `frontend/src/`；§10 → `io/tensors.py` 与 `vsr/__init__.py` 的 `show`；§11 → `record/`
  - §12 → `api.py`、`analyzers/`、`docs/plugins.md`；§13 → `dataset/`；§15 → `dsp/edit.py`
  - §16 → `presets.py`、`plot.py`、`dsp/__init__.py`、`skills/`（公共 API 的签名逐个对照）；§17 → `tests/bench/`；§18 → 仓库结构本身
  - 过程文件（`LIFECYCLE.md`、`CHANGELOG.md`、`scripts/check_diff_rules.py`、`docs/acceptance/`、`docs/reviews/`、`docs/dev/`）不在比较范围内。
- Docs to sync：`docs/DESIGN.md` §21；`docs/plugins.md`（M5）；`docs/manual-checks.md`（M4、M7 各有条目）；`CHANGELOG.md`。

## Delivery

- Version source：`pyproject.toml` 的 `[project].version`，唯一来源，不另设 `__version__`。1.0 之前取 `0.<n>.<p>`：每个交付的发布周期 minor + 1（C1 → 0.1.0，C2 → 0.2.0，C3 → 0.3.0），hotfix 周期 patch + 1（0.1.1）。`1.0.0` 由 Human 在真机检查之后决定，agent 不赋予。
- Changelog：仓库根的 `CHANGELOG.md`。每个 release 一节 `## <version> - <YYYY-MM-DD>`，分 Added / Changed / Fixed，每条标注 milestone 或 backlog id。
- Acceptance reports：`docs/acceptance/M<k>.md`（每个 milestone phase 一份）与 `docs/acceptance/release-<version>.md`（每个 release 一份），中文（面向 Human）。表格每个 exit criterion 一行：编号、结果（通过 / 失败 / 未验证）、证据（测试名、命令与输出摘要、截图路径 `frontend/test-results/screens/M<k>-*.png`、实测数值）。另列本阶段在运行平台上测得的 §17 数值（平台、设备、3 次中位数）、与同平台上一次数值的比较（回退写明）与「与 DESIGN 不一致之处」。失败与未验证保留原标签并写明原因。release 报告另含全量回归结果、drift audit 结论、性能对比、install smoke 输出与未决项。
- Install smoke：从构建产物而不是工作树，在干净环境中安装并运行：
  1. `npm run build`（在 `frontend/` 下），再 `uv build`；wheel 须含 `src/vsr/web/**`（DESIGN §18）。
  2. 在临时目录新建 venv，按 AGENTS.md「命令」的做法先装本机对应的 torch，再安装刚构建的 wheel。
  3. 用临时 `VSR_HOME` 运行 `vsr serve --no-browser`，从 `$VSR_HOME/runtime.json` 取 port 与 token：不带 token 的 `GET /api/session` 返回 401，带 token 返回 200，`GET /`（静态页）返回 200。
  4. `vsr.resolve_preset("analysis", 48000)` 成功，且 `importlib.resources` 能读到 `vsr/skills/vsr-speech-visualization/presets.toml`（DESIGN §16）。
  5. 停止 server；各步输出记入 release 报告。
- Tag form：带注释的 tag `v<version>`（如 `v0.1.0`；hotfix 的 patch 如 `v0.1.1`），message 为 `Release <version>`，打在 release commit 上：常规周期在集成分支上，hotfix 周期在 `hotfix/<version>` 分支上（Integration）。按 Integration 的 Push 规则在本地创建，并在 release 交付时 push。
- Publish steps：远端 `origin` 是本项目的公开 GitHub 仓库；push 与 GitHub Release 按 Integration 的 Push 规则（常设授权 H34–H36）；向包索引上传及其他任何发布仍在 Authorization boundary gate 之后。发布之前，Human 对整棵树与全部提交的元数据再做一次公共仓库扫描（见 Checks）。

## Maintenance

- Health checks：作为一个派发的 task 运行，并配核对席位。
  - Python：`uv lock --check`、`uv audit --no-dev`（uv 目前标为 experimental，会打印一条警告）、`uv tree --outdated --depth 1`。
  - 前端：`npm audit --omit=dev`、`npm outdated`（在 `frontend/` 下）。
  - 基准：`tests/bench/` 下全部脚本。
  - Finding：运行时依赖有已知漏洞；可更新到声明范围内的新版本（由 controller 决定并记录，更新后须通过全量回归；超出声明范围，或要替换锁定的库，走 Scope gate）；某个 §17 行在同平台、同设备上比上一个 release 的中位数慢、且超出上一次 3 次运行的范围（与 §17 参考值的差距本身不是 finding）。
- Hotfix classes：在默认的数据丢失、崩溃、数值错误之外，以 DESIGN 为准具体化如下。
  - 数据丢失：用户文件被未经显式保存地改写或覆盖，录音丢失样本却没有 overflow 记录，往数据集目录写了文件（DESIGN §4、§11、§13、§15）。
  - 崩溃：对受支持的输入，server 退出或前端白屏。
  - 数值错误：输出违反 DESIGN §8、§14 的定义或 §19 的数值验收。
  - 安全项被破坏：非回环绑定、缺失 token 校验、`weights_only` 或 `allow_pickle` 被放开（DESIGN §4）。

## Decisions and gates

- Agent decisions：skill default，并具体化为：controller 独自决定并记录（`docs/dev/decisions.md`；涉及产品的，由下一个 integration task 追加到 §21，见 State and records 的 Decision record）：DESIGN 未覆盖处，符合 §0 原则的最简单实现；模块内部结构与内部接口；task 的拆分与 phase 内的顺序；声明范围内的依赖更新；不改变结果的、对参考实现的偏离；仅开发用的新依赖（linter 与类型检查器除外，那是 Rules gate）。
- Project gates：
  1. 数据安全：改动 DESIGN §4 的安全项、AGENTS.md「不可省略」，或用户文件、录音、数据集的读写方式（§11、§13、§15）。
  2. 验收项无法诚实通过：task 报告 BLOCKED 并附失败输出。判定为实现缺陷则返工；判定为验收项本身有误或欠定义（例如数值的依据不成立），写成提案（附实测与最小修正）走 Scope gate，其余工作继续。
  3. 许可与署名：LICENSE、`pyproject.toml` 与 `package.json` 的作者和维护者字段、版权声明，以及任何点名个人或机构的文字，由 Human 决定，agent 不填写。
  4. 真机检查（M4、M7 的 `docs/manual-checks.md`）与 M1 之后的 UI 检查由 Human 完成，agent 不把它们标为通过。Human 的意见写进 `INBOX.md`，下一次 intake 处理。
- Gate 请求：写明它属于 skill 的 gate 表中的哪一行，或上面哪条项目 gate；不属于任何一行的问题由 controller 决定并记录，不向 Human 提问。
- Accepted instruction：对 `impl` 而言，本 run 的 accepted instruction 是 Human 的启动授权（记录在 `human-inputs.md`）加上 Requirements 与本文件；phase plan 中的每个 task 是登记在它之下的子任务。task 需要超出自身范围的东西时报告 BLOCKED，不自行扩大范围。
- Phase 结束的 heads-up（不阻塞）：每个 milestone phase 结束时，controller 经 host 的 human channel 发一条：phase 名、验收报告路径、截图目录、与 DESIGN 的偏离。
