# decided — vsr

已经定下、不再重新提出的问题，每条引用 H<n> 或决策编号。intake 与提问之前先查本文件；只追加。

- VST 与插件 I/O，以及 DESIGN §1「v1 不做」的各项：不做，也不预留接口或配置（H15；DESIGN §1）。
- 后端用 FastAPI，不用 Flask（D2）。
- 形态是本地 web server + Chrome 页面，不做桌面打包（D1）。
- 播放在浏览器，录音与 RIR 测量在后端（D3）。
- 单轨编辑与多轨合为一个 Lanes 视图（D4）。
- 目录名不带「!」：`visualized-speech-research`；包名与 CLI 为 `vsr`（D5；H12）。
- 计算设备是单一设置 `compute_device`，启动与切换时 self-check，失败回退 cpu（D6；H14）。
- 配套 skill 在包内，`presets.toml` 是 preset 的唯一定义，内容由 Human 决定（D7；H13）。
- milestone 顺序：编辑在 M3，T-F 选框与框内试听在 M1（D8；H17）。
- 设计 review 的三条可选建议不采纳：librosa 拆为 extra、ltas 取 `pow2_win = false`、ε(f) 平滑过渡（D11）。
- 开发与维护全部由 AI 完成；开发规则针对 GPT 的过度防御（H18）。
- 受跟踪的文件不放个人信息（H19）。
