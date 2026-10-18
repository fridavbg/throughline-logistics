import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The demo runs on a fixed clock, so code must read time from getNow() (lib/time.ts).
  // new Date(isoString) for parsing stays allowed.
  {
    files: ["lib/**/*.ts", "app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["lib/time.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: "Use getNow() from lib/time.ts: the demo runs on a fixed clock.",
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: "Use getNow() from lib/time.ts: the demo runs on a fixed clock.",
        },
      ],
    },
  },
  // Views get shipments through the normalized model, never from operator payloads.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/data/raw", "@/data/raw/*"],
              message: "Components never read raw operator payloads: use the normalized shipments.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
