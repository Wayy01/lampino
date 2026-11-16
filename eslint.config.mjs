import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // A "use server" module may only export async functions. Anything else —
    // a type re-export like `export type { X }`, a constant, a sync function, a
    // class — gets registered as a server action under a name that may not
    // exist at runtime, and the module throws on load (this 500'd every
    // checkout in Nov 2026). Type aliases and interfaces declared in place
    // (`export type X = …`) are erased and fine.
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...serverActionExportRules()],
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

function serverActionExportRules() {
  const inUseServer = "Program:has(> ExpressionStatement[directive='use server'])";
  const reexport = "Don't re-export from a \"use server\" file; import the name from its own module.";
  const asyncOnly = "A \"use server\" file may only export async functions; move this to a plain module.";
  return [
    [`ExportNamedDeclaration[source]`, reexport],
    [`ExportAllDeclaration`, reexport],
    [`ExportNamedDeclaration[exportKind='type'][declaration=null]`, reexport],
    [`ExportSpecifier[exportKind='type']`, reexport],
    [`ExportNamedDeclaration > VariableDeclaration > VariableDeclarator:not([init.async=true])`, asyncOnly],
    [`ExportNamedDeclaration > FunctionDeclaration[async=false]`, asyncOnly],
    [`ExportDefaultDeclaration > FunctionDeclaration[async=false]`, asyncOnly],
    [`ExportNamedDeclaration > ClassDeclaration`, asyncOnly],
    [`ExportDefaultDeclaration > ClassDeclaration`, asyncOnly],
  ].map(([selector, message]) => ({ selector: `${inUseServer} ${selector}`, message }));
}
