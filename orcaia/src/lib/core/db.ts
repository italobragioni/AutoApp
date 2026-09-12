import { PrismaClient } from "@prisma/client";

// Singleton do Prisma. Em desenvolvimento o Next recarrega os modulos a cada
// alteracao; sem o cache global, cada reload abriria uma nova conexao ate
// estourar o limite do banco.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
