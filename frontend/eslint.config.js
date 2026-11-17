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
