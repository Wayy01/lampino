import { mkdirSync, writeFileSync } from "node:fs";
import { adminCookie, cleanupOrders, prisma } from "./db";

// Leftovers from an aborted run would skew the stock assertions, and the admin
// specs need a signed session.
export default async function globalSetup() {
  await cleanupOrders();
  mkdirSync("e2e/.auth", { recursive: true });
  writeFileSync(
    "e2e/.auth/admin.json",
    JSON.stringify({
      cookies: [
        {
          name: "lampino-admin",
          value: await adminCookie(),
          domain: "localhost",
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    }),
  );
  await prisma.$disconnect();
}
