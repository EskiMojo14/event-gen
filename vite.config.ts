import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  pack: {
    entry: ["src/index.ts"],
    sourcemap: true,
    format: ["esm", "cjs"],
    dts: true,
  },
  lint: {
    plugins: ["oxc", "typescript", "unicorn", "react", "import"],
    categories: {
      correctness: "warn",
    },
    options: {
      typeAware: true,
      typeCheck: true,
      reportUnusedDisableDirectives: "error",
    },
    env: {
      builtin: true,
      "shared-node-browser": true,
    },
    ignorePatterns: ["dist"],
    rules: {
      "typescript/array-type": ["error", { default: "generic" }],
      "typescript/consistent-type-imports": ["error", { fixStyle: "separate-type-imports" }],
    },
    overrides: [
      {
        files: ["**/*.test.{js,mjs,cjs,ts,jsx,tsx}"],
        plugins: ["vitest"],
        rules: {
          "vitest/valid-title": ["error", { allowArguments: true }],
        },
      },
    ],
  },
  staged: {
    "*.{ts,md}": "vp fmt",
  },
  fmt: {},
  test: {
    coverage: {
      provider: "v8",
    },
    projects: [
      {
        test: {
          include: ["**/*.node.{test,spec}.ts"],
          name: "unit",
          environment: "node",
        },
      },
      {
        test: {
          include: ["**/*.browser.{test,spec}.ts"],
          name: "browser",
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
          includeTaskLocation: true,
        },
      },
      {
        test: {
          name: "typecheck",
          typecheck: {
            enabled: true,
            only: true,
          },
        },
      },
    ],
  },
});
