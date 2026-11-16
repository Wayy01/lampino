import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // A "use server" module may only export async functions. Anything else —
    // a re-export like `export type { X }`, a constant, a sync function — gets
    // registered as a server action under a name that may not exist at runtime,
    // and the module throws on load (this 500'd every checkout in Nov 2026).
    // Plain `export type X = …` / interface declarations are erased and fine.
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Program:has(> ExpressionStatement[directive='use server']) ExportNamedDeclaration[declaration=null]",
          message:
            "Don't re-export from a \"use server\" file; import the name from its own module.",
        },
        {
          selector: "Program:has(> ExpressionStatement[directive='use server']) ExportAllDeclaration",
          message: "Don't re-export from a \"use server\" file; import the name from its own module.",
        },
        {
          selector:
            "Program:has(> ExpressionStatement[directive='use server']) ExportNamedDeclaration > VariableDeclaration",
          message: "A \"use server\" file may only export async functions; move this to a plain module.",
        },
        {
          selector:
            "Program:has(> ExpressionStatement[directive='use server']) ExportNamedDeclaration > FunctionDeclaration[async=false]",
          message: "A \"use server\" file may only export async functions.",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma's generated client is machine-generated — don't lint it.
    "lib/generated/**",
  ]),
]);

export default eslintConfig;
