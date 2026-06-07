import { cloudflare } from "@cloudflare/vite-plugin";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { RECOMMENDED_RULES, TANSTACK_START_RULES } from "oxlint-plugin-react-doctor";
import { defineConfig } from "vite-plus";

const reactDoctorRules = {
  ...RECOMMENDED_RULES,
  ...TANSTACK_START_RULES,
};

// テスト実行時は Cloudflare プラグインを外す。worker 環境向けに注入される
// resolve.external が vite-plus-test と衝突して起動できないため。純粋関数の
// 単体テストに workerd 環境は不要。
const isTest = !!process.env.VITEST;

export default defineConfig({
  fmt: {
    ignorePatterns: ["**/routeTree.gen.ts"],
    sortImports: {
      partitionByComment: true,
    },
    sortPackageJson: {
      sortScripts: true,
    },
    sortTailwindcss: {
      functions: ["cn"],
    },
  },
  lint: {
    categories: {
      correctness: "error",
    },
    env: {
      browser: true,
      node: true,
    },
    ignorePatterns: ["**/routeTree.gen.ts"],
    jsPlugins: [{ name: "react-doctor", specifier: "oxlint-plugin-react-doctor" }],
    options: {
      denyWarnings: true,
      typeAware: true,
      typeCheck: true,
    },
    overrides: [
      {
        files: ["src/router.tsx", "*.config.ts"],
        rules: {
          "no-default-export": "off",
        },
      },
      {
        files: ["src/routes/**"],
        rules: {
          "react-doctor/no-multi-comp": "off",
          "react-doctor/only-export-components": "off",
        },
      },
    ],
    plugins: ["react", "react-perf", "import", "jsx-a11y", "promise"],
    rules: {
      ...reactDoctorRules,
      "no-default-export": "error",
    },
  },
  staged: {
    "*.{js,jsx,ts,tsx,json,css}": "vp check --fix",
  },
  plugins: [
    ...(isTest ? [] : [cloudflare({ viteEnvironment: { name: "ssr" } })]),
    tailwindcss(),
    tanstackStart(),
    // react's vite plugin must come after start's vite plugin
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
