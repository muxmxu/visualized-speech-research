# backlog — vsr

每个条目 B<n>：来源（H<n>、health check、review）、类别（hotfix、scope、ordinary）、状态、周期。intake 时追加；不删除，完成的条目改状态。

| id | 条目 | 来源 | 类别 | 状态 | 周期 |
|---|---|---|---|---|---|
| B1 | README.md（安装与使用）：DESIGN §18 的仓库结构没有它；仓库共享或公开前需要。不含作者与许可文字（`LIFECYCLE.md` 项目 gate 3） | H19（T4 实例化时发现） | ordinary | 留在 backlog：C1 的计划没有选它；在 C2 的周期计划里决定 | — |
| B2 | LICENSE 与作者、维护者字段：由 Human 决定，agent 不填写；发布之前需要 | H19（T4 实例化时发现） | scope | 等 Human；需要时（发布之前）作为 gate 请求 | — |
| B3 | 可在工作台对屏幕可见图像框选局部并导出 PDF；当前 DESIGN 只有 `vsr.plot.savefig` 的 PDF 元数据描述，没有工作台视口局部导出 | H45 | scope | 已获 Human 授权，待写入 DESIGN 并列入 milestone 计划 | C1 |
| B4 | RIR 视图增加脉冲响应系数与延迟 τ 双轴图，可点选直达声与后续到达并读出时间、振幅及延迟差；与既有 EDC、拟合线和结果表一起实现 | H48 | scope | Interaction and acceptance specified by accepted arch-M7; implementation is active in M7 | C3 |
| B5 | `npm ci` 的审计摘要报告 12 项 high severity 漏洞；在 C1 发布前核对依赖来源、影响路径与修复版本 | M1-T4a mechanical audit | ordinary | Audited for the C1 candidate: zero runtime findings and 12 high development-toolchain entries; recorded paths and suggested versions in release acceptance | C1 |
