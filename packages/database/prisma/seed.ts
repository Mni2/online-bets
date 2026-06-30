import { PrismaClient, Currency, Role, KycStatus, GameCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = "novaroyalhelp@gmail.com";
  const passwordHash = await bcrypt.hash("ChangeMe!2026", 12);

  // Update existing user with username "admin" to prevent unique constraint failures
  await prisma.user.updateMany({
    where: { username: "admin" },
    data: { email },
  });

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      username: "admin",
      displayName: "Nova Admin",
      passwordHash,
      role: Role.superadmin,
      kycStatus: KycStatus.approved,
      emailVerifiedAt: new Date(),
    },
  });

  const wallet = await prisma.wallet.upsert({
    where: { userId_currency: { userId: admin.id, currency: Currency.USD } },
    update: {},
    create: {
      userId: admin.id,
      currency: Currency.USD,
      balance: "10000",
      bonusBalance: "0",
      locked: "0",
    },
  });

  const dice = await prisma.game.upsert({
    where: { slug: "dice-100" },
    update: {},
    create: {
      slug: "dice-100",
      name: "Dice 100",
      category: GameCategory.dice,
      rtp: "98.5",
      houseEdge: "1.5",
      isLive: false,
      enabled: true,
      config: { minBet: "0.10", maxBet: "10000", maxMultiplier: 99 },
      thumbnailUrl: "/games/dice.png",
    },
  });

  const crash = await prisma.game.upsert({
    where: { slug: "crash-arcade" },
    update: {},
    create: {
      slug: "crash-arcade",
      name: "Crash Arcade",
      category: GameCategory.crash,
      rtp: "99.0",
      houseEdge: "1.0",
      isLive: true,
      enabled: true,
      config: { minBet: "0.10", maxBet: "5000", maxMultiplier: 1000 },
      thumbnailUrl: "/games/crash.png",
    },
  });

  await prisma.bonus.upsert({
    where: { code: "WELCOME100" },
    update: {},
    create: {
      code: "WELCOME100",
      name: "100% Welcome Bonus",
      type: "welcome",
      amount: "500",
      currency: Currency.USD,
      wageringReq: "2500",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });

  console.log("Seed complete:", { admin: admin.email, wallet: wallet.id, games: [dice.slug, crash.slug] });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
