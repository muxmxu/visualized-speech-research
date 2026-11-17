# 开发规则的配置文本

`AGENTS.md`「开发规则（lifecycle v1）」的配套配置：M0 把下面的文本原样写入各自的文件（`pyproject.toml`、`frontend/eslint.config.js`、`frontend/package.json`、vitest 与 Playwright 配置、`scripts/check_diff_rules.py`）。D25 是原批准决定（记录在状态目录的 `history/`）；D39 按 H43 修正说明注释并精确排除两份受保护 Markdown 的格式检查。写入后它们属于 Protected standards（`LIFECYCLE.md`）。

另有 `pyproject.toml` 的 `[tool.pytest.ini_options] testpaths = ["tests"]`，不属于上述 linter 配置：task 与 phase 的 worktree 在仓库内的 `agent_workspace/` 下，不限定 `testpaths` 时 pytest 会收集到其他 worktree 里的测试。

## 已知版本约束与局限

- **TypeScript 版本。** typescript-eslint 8.72.2 的 peer 依赖是 `typescript >=4.8.4 <6.1.0`，而 2026-11-16 查到 npm 上 TypeScript 的最新版是 7.0.2。同时安装时 npm 解析到 TypeScript 6.0.3；先单独装最新的 TypeScript 再装 typescript-eslint 会得到 peer 冲突。M0 的前端依赖要把 TypeScript 限制在 6.0.x。
- **规则检查脚本的已知局限**（来自 T3 的 review 备注，规则靠下面的配置补上）：
   - 脚本不识别 `test.describe.only(`、`test.describe.skip(` 与 `test.fail(`，由 Playwright 的 `forbidOnly` 与不用条件 skip 补上。
   - Playwright 的 `test.skip(cond, reason)` 被脚本判为 FAIL（T1），所以 e2e 里不用条件 skip（见 AGENTS.md「常见的写法，与规则下应该怎样写」）。
   - `except` 行不变、只把处理器的 body 改成 `pass` 时脚本不报，由 ruff 的 `S110` 补上。
   - 前端 `catch (e) { console.error(e) }` 脚本不报，由 ESLint 的 `no-console` 补上。

## 配置文本（原 C 部分）

### C.1 `pyproject.toml` 的 ruff 表

```toml
[tool.ruff]
line-length = 100
target-version = "py311"
# 规则检查脚本是 long-term skill 的逐字节副本，不按本项目的风格改写；human-owned（D25）。
extend-exclude = ["scripts/check_diff_rules.py"]

[tool.ruff.format]
# Preserve human-owned specification and bundled skill text (D39; H43).
exclude = ["docs/DESIGN.md", "src/vsr/skills/vsr-speech-visualization/SKILL.md"]

[tool.ruff.lint]
select = [
    "E", "F", "W", "I", "UP", "B",      # 基线
    "BLE001",                            # 笼统的 except Exception
    "S110", "S112",                      # try-except-pass、try-except-continue
    "SIM105",                            # try-except-pass 应写成 contextlib.suppress
    "TRY201", "TRY203",                  # 多余的 re-raise 与只会重新抛出的处理器
    "ERA001",                            # 被注释掉的代码
    "PGH003", "PGH004", "RUF100",        # 笼统的 type: ignore 与 noqa，无用的 noqa
    "PT011", "PT012",                    # pytest.raises 过宽、块内有多条语句
]

[tool.ruff.lint.flake8-bandit]
# S110 与 S112 默认只查 Exception 与裸 except；打开后具名异常也查，与规则检查脚本的 C2 一致。
check-typed-exception = true

[tool.ruff.lint.flake8-bugbear]
# 下列调用作默认参数是规范写法：插件 API 的 Param（DESIGN §12）与 FastAPI 的参数声明（§7）。
# 不列出时，参数没有不可变类型标注的签名会触发 B008（D25）。
extend-immutable-calls = ["vsr.api.Param", "fastapi.Depends", "fastapi.Query", "fastapi.Body", "fastapi.Path"]
```

### C.2 `frontend/eslint.config.js`

```js
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/", "test-results/", "playwright-report/"] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // 根目录下的 *.config.ts 不在 tsconfig 里，用 allowDefaultProject 放行
        projectService: { allowDefaultProject: ["*.config.ts"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    // Inline configuration directives are ignored and reported as warnings; --max-warnings 0 rejects them.
    // 例外只写在本文件，附理由与决策编号。
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: "error" },
    rules: {
      "no-empty": "error", // 空 catch 与空块
      "no-console": "error", // catch 里只打印等于吞掉；错误在边界处用 notification 显示
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": true, "ts-ignore": true, "ts-nocheck": true, "ts-check": false },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unnecessary-condition": "error", // 对不可为空的值写 ?.、?? 或判空
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
    },
  },
  { files: ["**/*.js"], extends: [tseslint.configs.disableTypeChecked] },
);
```

`frontend/package.json` 的脚本：`"lint": "eslint . --max-warnings 0"`。`tsconfig` 须 `include` 所有被 lint 的 `.ts` 文件（`src` 与 `tests`），并保持 `"strict": true`。

### C.3 测试运行器的配置

```ts
// vitest（vite.config.ts 的 test 块，或 vitest.config.ts）
test: { allowOnly: false, retry: 0 }

// playwright.config.ts
forbidOnly: true,
retries: 0,
```

`retry` 与 `retries` 取 0：重试会把不稳定的测试变成偶尔的绿色，掩盖问题。

### C.4 规则检查脚本

```bash
cp <long-term skill 的 scripts 目录>/check_diff_rules.py scripts/check_diff_rules.py
python3 scripts/check_diff_rules.py --base master        # 用法见 B 部分
```

注释中的「B 部分」指 AGENTS.md「开发规则（lifecycle v1）」一节的「保护区与规则检查」。
