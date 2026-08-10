// PrismaClient singleton — generated from the production schema and ready to
// use, but the current design build reads from lib/data/* (mock data) instead.
// To go live later, swap the bodies of lib/data/* to real `prisma.*` queries;
// pages and components stay unchanged.
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
