// PrismaClient singleton, generated from prisma/schema.prisma into
// lib/generated/prisma. Everything that reads the database goes through
// lib/data/* (storefront) or lib/admin/* (CMS) — pages never import this.
import { PrismaClient } from "./generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
