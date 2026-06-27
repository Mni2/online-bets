type Stubbed = any;

const stubEnabled = process.env.NOVA_DB_STUB === "1";

let realPrisma: any = null;
if (!stubEnabled) {
  const { PrismaClient } = await import("@prisma/client");
  const globalForPrisma = globalThis as unknown as { prisma?: any };
  realPrisma =
    globalForPrisma.prisma ??
    new PrismaClient({
      log:
        process.env.NODE_ENV === "production"
          ? ["error"]
          : ["query", "info", "warn", "error"],
    });
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = realPrisma;
  }
}

export const prisma: Stubbed = stubEnabled
  ? (globalThis as any).__novaDbStub
  : realPrisma;

// Always export the prisma client types so application code compiles either way.
export * from "@prisma/client";