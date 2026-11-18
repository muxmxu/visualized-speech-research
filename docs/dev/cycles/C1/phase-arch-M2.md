# C1 architecture amendment for M2-T5a

Follow the [M2 phase plan](phase-M2.md) for dispatch, locks and check environments.
T5 retains its existing scope and can proceed while this architecture phase runs.
T5a requires accepted T5 and this delivered architecture amendment. T6 starts from the delivered architecture baseline on `master`.

The independent [Plan Review](reports/plan-review-arch-M2.md) approved with three findings addressed by this amendment. Runtime-based CLI HTTP uses direct loopback and the regression verifies zero proxy traffic. Cold registration and expiry have defined startup and cleanup ownership. Capacity, expiry and claim failure each have an observable acceptance check.

## A1 — Bind the launch contract

Under D38, cut one dedicated `phase/arch-M2` branch from a recorded `master` commit. The sole write set is `docs/DESIGN.md` §§7 and 21. The spec delta implements the D49 clarification of the existing §§4 and 10 behavior, following the D43 architecture precedent. The public no-header contract, §16, authentication, file and write policy, scope, dependencies and acceptance criteria retain their existing requirements.

Insert this single paragraph immediately after the existing §7 `POST /open {paths}` bullet. Copy the paragraph text without the quote marker.

> `vsr [paths...]` 含 tensor 文件时，CLI 把以调用方工作目录解析得到的绝对路径交给同一 server，由本次打开的浏览器页接续解释流程。冷启动在 server 开始处理请求前登记路径，并在应用 lifespan 启动时安装过期回调。热启动用现有的鉴权 `POST /open {paths}` 加私有请求头 `X-VSR-Open-Launch: stage` 登记，返回 `{"launch_id": "<id>"}`。CLI 根据 runtime 发出的探测、设置和打开请求均直连本机回环地址，不经环境代理。每次调用使用由 `secrets.token_urlsafe(32)` 生成的独立一次性标识，格式为 43 个 URL-safe 字符。CLI 沿用 §4 的 token 启动地址，只在 URL fragment 附加 `#open=<id>`。前端初始化时用 `history.replaceState` 移除该 fragment，然后用带 Bearer token 的 `POST /open {"paths":[]}` 加 `X-VSR-Open-Launch: <id>` 领取。领取会在读取文件前原子移除登记项，成功后返回单 tensor 的既有解释响应，或对多路径返回 `{"lanes":[...],"interpretations":[...]}`。两数组各自保留参数顺序，`interpretations` 中每项沿用单 tensor 的 `{needs_interpretation: true, path, tree}` 结构。所有文件读取与检查成功后才发布音频 lanes，前端依次使用 §10 的解释对话框，当前项确认成功或取消后进入下一项。未领取的路径只存于 server 内存，最多保留 5 分钟且同时最多 64 项。登记的列表须由绝对路径组成，且至少含一项 §10 支持的 tensor 扩展名（忽略大小写）。非法登记、非空路径领取或非法头返回 422，未知、已领取（含领取后文件处理失败）或过期的标识返回 404，登记满额返回 429，均使用本节错误 body。私有流程的成功响应使用 `Cache-Control: no-store`。浏览器只在当前页面内存中持有领取所得的路径和 tensor tree。此请求头仅用于 CLI 与本应用页面的接续流程。不带该头的 `POST /open` 以及 `POST /upload` 沿用原有请求与响应。

Append one D49 entry in §21.

> D49（2026-11-18）：CLI 通过现有鉴权 `POST /open` 的私有接续流程，以一次性标识将本次 tensor 启动与浏览器解释对话框绑定。冷启动和热启动复用限时内存登记，避免文件路径进入启动 URL 或浏览器存储，并保留原有文件打开接口。

## A2 — Verify and deliver the spec-only delta

The independent Auditor checks the frozen revision with `git diff --check <cut-commit>`, the exact write set, the public-repository scan and `python3 scripts/check_diff_rules.py --base <cut-commit>`.
Run the LIFECYCLE chapter comparison. Require exactly §§7 and 21 to differ, with preamble, headings and existing §21 lines intact. Require the §7 change to be the paragraph above and §21 to append exactly D49. Require zero runtime source, test or configuration diff.
The independent Task Reviewer checks the protocol and boundaries below on the same revision and disposes of each rule REVIEW. Run the applicable full AGENTS checks under the existing checks lock.
After both verdicts pass, the authorized D38 executor uses the LIFECYCLE integration procedure to land the frozen spec-only delta on `master`. Verify the squash's DESIGN patch against the accepted patch, compare chapters and the write set against the immediate pre-integration baseline, and run prescribed post-integration checks. Record both baselines and the delivered spec commit.
The T5a dispatch base must include accepted T5 and the delivered spec commit, with the reviewed DESIGN hunk intact. Record the combined base before source edits. T6 cuts `phase/M2` from `master` containing the same delivered spec commit. After merging the accepted tasks, verify that §7 matches the phase cut and D49 occurs exactly once. T6's own DESIGN delta is append-only §21.

## T5a implementation and checks

Use the six-file write set and Python and Chromium commands in the [T5a task plan](phase-M2.md#t5a--cli-tensor-launch-compatibility).

- Backends and CLI use the existing path resolution and loaders. Prepare tensor argv in order, including repeated paths. Warm audio-only calls plain `/open` before browser launch and cold audio-only uses the current startup loader. Tensor launch requests a distinct tab, after warm stage acknowledgement or cold registration. Ping, settings, stage and ordinary warm open use the same proxy-free loopback transport. Create the cold app and launch the browser inside the existing listener and runtime-file cleanup scope. Arm cold expiry in lifespan startup and warm expiry at stage using a monotonic deadline, cancel the callback on claim, and clear remaining entries and callbacks on shutdown.
- Stage performs no file I/O or publication. Authenticate either private mode before lookup. Header and body mismatch or a duplicate header returns 422. Valid IDs are 43 characters from `[A-Za-z0-9_-]`. Redeem before any file read or await that could permit another claim. Read the complete batch before publishing its ordered audio subset once, with the existing lanes-changed event. A read error publishes no batch lanes and leaves the ID consumed. Plain `/open` retains its empty, audio, singleton tensor and existing unsupported plural tensor behavior. Files and upload keep their T5 contracts.
- At app bootstrap, keep the existing token handling, capture the launch fragment, and remove it from the current history entry before the one same-origin claim. Preserve unrelated query parameters. After a successful claim refresh session, then feed the ordered interpretation records to the existing modal. Advance on successful confirmation or cancellation. Keep the CLI launch ID, paths and trees in memory and out of browser storage and Files Recent.
- Python CLI tests use isolated real-server fixtures for cold and warm launches. Test that warm explicit-device ping, settings and staging reach the running server with an actual recording HTTP proxy configured and bypass variables clear. Assert zero proxy requests. Verify browser dispatch follows staging, and independently exercise constructor and browser-launch exceptions, checking the listener and runtime file are released.
- HTTP tests cover ordinary, singleton, mixed and all-tensor replies, reverse-order distinct claims, unauthorized and malformed requests, and exactly one success for simultaneous claims of one ID. Use valid audio followed by an invalid tensor to assert no partial publication and 404 on replay. Stagger the first of 64 stages, require a 429 for the 65th, expire only the earliest entry with a controlled clock, then assert its 404, one new successful stage, another 429 and a live entry still claimable.
- Chromium exercises cold singleton and warm mixed commands with real CLI and server subprocesses. Capture browser dispatch at the system boundary and drive actual Chromium. Assert audio exactly once, dialog order, cancel progression, selected confirmation and lane counts. Verify a plain page gets no dialog, scrubbing happens before the private POST, reload and back navigation do not replay, and URL, history and storage expose no supplied path or tree. Retain the real Files and upload regressions.
