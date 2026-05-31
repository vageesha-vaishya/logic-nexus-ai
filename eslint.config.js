// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import { createRequire } from "node:module";

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import * as mdx from "eslint-plugin-mdx";

const require = createRequire(import.meta.url);
let storybook = null;
try {
  storybook = require("eslint-plugin-storybook");
  if (storybook && storybook.default) storybook = storybook.default;
} catch {
  storybook = null;
}
const storybookFlatRecommended = storybook?.configs?.["flat/recommended"] ?? {};

// Phase 2 Step 7 — direct reads of public.accounts / public.contacts.
// Hoisted to a const so the providers-dir override below (which re-enables
// the parties bans while allowing SDK imports) can't silently drift from
// the base config when one side is edited.
const PARTIES_BANS = [
  {
    selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='from'][arguments.0.type='Literal'][arguments.0.value='accounts']",
    message: "Phase 2 Step 7: use .from('v_accounts') instead of .from('accounts'). The public.accounts table is being dropped in Step 9; reads should go through public.v_accounts which sources identity from core.parties.",
  },
  {
    selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='from'][arguments.0.type='Literal'][arguments.0.value='contacts']",
    message: "Phase 2 Step 7: use .from('v_contacts') instead of .from('contacts'). The public.contacts table is being dropped in Step 9; reads should go through public.v_contacts which sources identity from core.parties.",
  },
];

// Phase 6 Step 32 — direct imports of comms provider SDKs.
//
// Only services/comms-api/src/providers/ may import these. Everyone else
// goes through the comms-api HTTP surface (or the core.notifications →
// comms-api dispatcher chain — see comms.md §5). Mirrors the architectural
// guarantee written into services/comms-api/src/providers/email-provider.ts
// header comment that lint would enforce. Stops a future contributor from
// dropping `import { Resend } from 'resend'` into a feature module and
// bypassing the comms.suppressions / delivery_events / template versioning
// the dispatcher provides.
//
// Covers both ESM `import` and CommonJS `require()` forms. Patterns
// include sub-imports (`firebase-admin/auth`, `@twilio/voice-sdk`) plus
// type-only imports (TS still emits an ImportDeclaration node for those).
const COMMS_PROVIDER_SDK_BANS = [
  {
    selector: "ImportDeclaration[source.value=/^(resend|nodemailer|twilio|firebase-admin|mailgun\\.js|postmark|sendgrid|@sendgrid\\u002Fmail|@sendgrid\\u002Fclient)$/]",
    message: "Phase 6 Step 32: comms provider SDKs may only be imported from services/comms-api/src/providers/. Use the comms-api dispatch path (core.notifications → comms.deliveries) instead so suppressions, delivery_events, template versioning, and RFC 8058 unsubscribe headers are applied. See comms.md §5.",
  },
  {
    selector: "ImportDeclaration[source.value=/^(@twilio|@mailgun)\\u002F/]",
    message: "Phase 6 Step 32: comms provider SDKs may only be imported from services/comms-api/src/providers/. See comms.md §5.",
  },
  {
    selector: "ImportDeclaration[source.value=/^firebase-admin\\u002F/]",
    message: "Phase 6 Step 32: firebase-admin (incl. sub-imports like firebase-admin/messaging) may only be imported from services/comms-api/src/providers/. See comms.md §5.",
  },
  {
    selector: "CallExpression[callee.name='require'][arguments.0.value=/^(resend|nodemailer|twilio|firebase-admin|mailgun\\.js|postmark|sendgrid|@sendgrid\\u002Fmail|@sendgrid\\u002Fclient)$/]",
    message: "Phase 6 Step 32: comms provider SDKs may only be imported from services/comms-api/src/providers/. See comms.md §5.",
  },
  {
    selector: "CallExpression[callee.name='require'][arguments.0.value=/^(@twilio|@mailgun)\\u002F/]",
    message: "Phase 6 Step 32: comms provider SDKs may only be imported from services/comms-api/src/providers/. See comms.md §5.",
  },
  {
    selector: "CallExpression[callee.name='require'][arguments.0.value=/^firebase-admin\\u002F/]",
    message: "Phase 6 Step 32: firebase-admin (incl. sub-imports) may only be imported from services/comms-api/src/providers/. See comms.md §5.",
  },
];

export default tseslint.config(
  { ignores: ["dist", "storybook-static", "test-results", "docs", ".worktrees", ".claude", "coverage", "playwright-report", "**/.venv/**", "**/node_modules/**", "CHANGELOG.md", "RUN_MIGRATION.md", "dataentry/dataEntryInstructions.md"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "off",
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-ignore": "allow-with-description" }],
      // P5 — log discipline: use logger from @/lib/logger, never raw console
      "no-console": "error",
      // Phase 2 Step 7 + Phase 6 Step 32 — composed bans (see consts at top
      // of file for the full rationale on each set). Tests + the providers
      // dir + supabase/functions get scoped overrides below.
      "no-restricted-syntax": ["error", ...PARTIES_BANS, ...COMMS_PROVIDER_SDK_BANS],
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
    files: [
      "src/pages/dashboard/**/*.{ts,tsx}"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/exhaustive-deps": "off"
    },
  },
  {
    files: [
      "src/lib/**/*.{ts,tsx}",
      "src/services/**/*.{ts,tsx}",
      "src/tests/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      "dataentry/**/*.{ts,tsx}"
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/exhaustive-deps": "off"
    },
  },
  {
    // logger.ts and test/story files may reference console directly
    files: [
      "src/lib/logger.ts",
      "src/lib/global-error-handler.ts",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/*.stories.ts",
      "**/*.stories.tsx",
    ],
    rules: { "no-console": "off" },
  },
  {
    // Phase 2 Step 7 exemption — RLS-regression and access tests assert
    // behaviour on the underlying public.accounts / public.contacts tables,
    // not on the v_* views. The accounts/contacts string-literal bans
    // (no-restricted-syntax above) are off for tests.
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/__tests__/**",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    // Console output is the legitimate API in scripts, edge functions, build
    // configs, test harness, the Cloudflare worker, backend Express services,
    // browser extensions, and one-shot scripts — none of them have a logger
    // to delegate to. `no-console` is meant to catch raw console use in the
    // React app code, not in tooling or out-of-process code.
    files: [
      "supabase/functions/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
      "test/**/*.{ts,tsx}",
      "scripts/**/*.{ts,tsx}",
      "worker/**/*.{ts,tsx}",
      "services/**/*.{ts,tsx}",
      "nexus-connect-extension/**/*.{ts,tsx}",
      "src/pages/api/**/*.{ts,tsx}",
      "*.config.{ts,js,mjs}",
      "vite.config.ts",
      "vitest.config.ts",
      "verify_migration_suite.ts",
    ],
    rules: { "no-console": "off" },
  },
  {
    files: [
      "src/components/ui/enterprise/**/*.{ts,tsx}",
      "src/components/ui/button.tsx",
      "src/components/ui/card.tsx",
      "src/components/ui/checkbox.tsx",
      "src/components/ui/input.tsx",
      "src/components/ui/label.tsx",
      "src/components/ui/select.tsx",
      "src/components/ui/switch.tsx",
      "src/components/ui/table.tsx",
      "src/components/ui/tabs.tsx",
      "src/components/ui/textarea.tsx",
      "src/components/ui/tooltip.tsx"
    ],
    rules: {
      "no-restricted-imports": ["error", {
        "paths": [
          { "name": "@/integrations/supabase/client" },
          { "name": "@/hooks/useCRM" },
          { "name": "@/lib/db/access" },
          { "name": "@/services" }
        ],
        "patterns": [
          "@/integrations/supabase/*",
          "@/services/*"
        ]
      }]
    },
  },
  {
    files: [
      "src/features/module-crm/**/*.{ts,tsx}"
    ],
    rules: {
      "no-restricted-imports": ["error", {
        "patterns": [
          "@/features/module-logistics/*",
          "@/features/module-logistics/**",
          "@/features/module-quotation/*",
          "@/features/module-quotation/**",
          "@/features/module-finance/*",
          "@/features/module-finance/**",
          "@/features/module-compliance/*",
          "@/features/module-compliance/**",
          "@/features/module-communications/*",
          "@/features/module-communications/**",
          "@/features/module-amro/*",
          "@/features/module-amro/**"
        ]
      }]
    },
  },
  {
    files: [
      "src/features/module-logistics/**/*.{ts,tsx}"
    ],
    rules: {
      "no-restricted-imports": ["error", {
        "patterns": [
          "@/features/module-crm/*",
          "@/features/module-crm/**",
          "@/features/module-quotation/*",
          "@/features/module-quotation/**",
          "@/features/module-finance/*",
          "@/features/module-finance/**",
          "@/features/module-compliance/*",
          "@/features/module-compliance/**",
          "@/features/module-communications/*",
          "@/features/module-communications/**",
          "@/features/module-amro/*",
          "@/features/module-amro/**"
        ]
      }]
    },
  },
  {
    files: [
      "src/features/module-quotation/**/*.{ts,tsx}"
    ],
    rules: {
      "no-restricted-imports": ["error", {
        "patterns": [
          "@/features/module-crm/*",
          "@/features/module-crm/**",
          "@/features/module-logistics/*",
          "@/features/module-logistics/**",
          "@/features/module-finance/*",
          "@/features/module-finance/**",
          "@/features/module-compliance/*",
          "@/features/module-compliance/**",
          "@/features/module-communications/*",
          "@/features/module-communications/**",
          "@/features/module-amro/*",
          "@/features/module-amro/**"
        ]
      }]
    },
  },
  {
    files: [
      "src/features/module-finance/**/*.{ts,tsx}"
    ],
    rules: {
      "no-restricted-imports": ["error", {
        "patterns": [
          "@/features/module-crm/*",
          "@/features/module-crm/**",
          "@/features/module-logistics/*",
          "@/features/module-logistics/**",
          "@/features/module-quotation/*",
          "@/features/module-quotation/**",
          "@/features/module-compliance/*",
          "@/features/module-compliance/**",
          "@/features/module-communications/*",
          "@/features/module-communications/**",
          "@/features/module-amro/*",
          "@/features/module-amro/**"
        ]
      }]
    },
  },
  {
    files: [
      "src/features/module-compliance/**/*.{ts,tsx}"
    ],
    rules: {
      "no-restricted-imports": ["error", {
        "patterns": [
          "@/features/module-crm/*",
          "@/features/module-crm/**",
          "@/features/module-logistics/*",
          "@/features/module-logistics/**",
          "@/features/module-quotation/*",
          "@/features/module-quotation/**",
          "@/features/module-finance/*",
          "@/features/module-finance/**",
          "@/features/module-communications/*",
          "@/features/module-communications/**",
          "@/features/module-amro/*",
          "@/features/module-amro/**"
        ]
      }]
    },
  },
  {
    files: [
      "src/features/module-communications/**/*.{ts,tsx}"
    ],
    rules: {
      "no-restricted-imports": ["error", {
        "patterns": [
          "@/features/module-crm/*",
          "@/features/module-crm/**",
          "@/features/module-logistics/*",
          "@/features/module-logistics/**",
          "@/features/module-quotation/*",
          "@/features/module-quotation/**",
          "@/features/module-finance/*",
          "@/features/module-finance/**",
          "@/features/module-compliance/*",
          "@/features/module-compliance/**",
          "@/features/module-amro/*",
          "@/features/module-amro/**"
        ]
      }]
    },
  },
  {
    files: [
      "src/features/module-amro/**/*.{ts,tsx}"
    ],
    rules: {
      "no-restricted-imports": ["error", {
        "patterns": [
          "@/features/module-crm/*",
          "@/features/module-crm/**",
          "@/features/module-logistics/*",
          "@/features/module-logistics/**",
          "@/features/module-quotation/*",
          "@/features/module-quotation/**",
          "@/features/module-finance/*",
          "@/features/module-finance/**",
          "@/features/module-compliance/*",
          "@/features/module-compliance/**",
          "@/features/module-communications/*",
          "@/features/module-communications/**"
        ]
      }]
    },
  },
  {
    // Phase 6 Step 32 — provider SDK ban exemption.
    //
    // services/comms-api/src/providers/ is the ONE canonical home for
    // direct provider SDK code. Re-enable the parties bans (which would
    // otherwise be silently dropped by this override) but drop the SDK
    // ban so the providers may import resend / nodemailer / twilio / etc.
    //
    // supabase/functions/ is also exempted: edge functions run under
    // Deno (npm: prefix module resolution), not Node, and the ban is
    // not enforceable there. The legacy supabase/functions/send-email/
    // is the only existing direct-SDK importer; its migration into
    // comms-api or deletion is tracked as a Phase 6 follow-up.
    files: [
      "services/comms-api/src/providers/**/*.{ts,tsx}",
      "supabase/functions/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": ["error", ...PARTIES_BANS],
    },
  },
  {
    ...mdx.flat
  },
  {
    ...mdx.flatCodeBlocks
  },
  storybookFlatRecommended
);
