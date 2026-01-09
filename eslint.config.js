import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import * as mdx from "eslint-plugin-mdx";

export default tseslint.config(
  { ignores: ["dist", "storybook-static", "test-results"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": ["warn", { ignoreRestArgs: true }],
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-ignore": "allow-with-description" }],
    },
    settings: {},
  },
  {
    files: ["supabase/functions/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  {
    files: [
      "src/components/aes-hts-code-manager.tsx",
      "src/components/sales/composer/**/*.{ts,tsx}",
      "src/pages/dashboard/ShipmentsPipeline.tsx",
      "src/components/sales/QuoteForm.tsx",
      "src/pages/dashboard/UIDemoForms.tsx",
      "src/pages/dashboard/UIDemoAdvanced.tsx",
      "src/pages/dashboard/data-management/DatabaseExport.tsx"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ...mdx.flat
  },
  {
    ...mdx.flatCodeBlocks
  }
);
