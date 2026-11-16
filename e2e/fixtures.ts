// Shared test fixture: every test fails on an uncaught page error or a
// console error it didn't declare as expected, and gets its own client IP so
// the checkout throttle (5 orders / 10 min / IP) never trips across tests.
import { test as base, expect } from "@playwright/test";

let ipSeq = 0;

export const test = base.extend<{ expectedConsoleError: RegExp | null }>({
  expectedConsoleError: [null, { option: true }],
  extraHTTPHeaders: async ({}, use) => {
    await use({ "X-Real-IP": `198.51.100.${(++ipSeq % 250) + 1}` });
  },
  page: async ({ page, expectedConsoleError }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !expectedConsoleError?.test(m.text())) {
        errors.push(`console: ${m.text()}`);
      }
    });
    await use(page);
    expect(errors, "unexpected browser errors").toEqual([]);
  },
});

export { expect };
