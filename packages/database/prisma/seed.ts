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
    update: {
      rtp: "80.0",
      houseEdge: "20.0",
      thumbnailUrl: "/games/dice.jpg",
    },
    create: {
      slug: "dice-100",
      name: "Dice 100",
      category: GameCategory.dice,
      rtp: "80.0",
      houseEdge: "20.0",
      isLive: false,
      enabled: true,
      config: { minBet: "0.10", maxBet: "10000", maxMultiplier: 99 },
      thumbnailUrl: "/games/dice.jpg",
    },
  });

  const crash = await prisma.game.upsert({
    where: { slug: "crash-arcade" },
    update: {
      rtp: "80.0",
      houseEdge: "20.0",
      thumbnailUrl: "/games/crash.jpg",
    },
    create: {
      slug: "crash-arcade",
      name: "Crash Arcade",
      category: GameCategory.crash,
      rtp: "80.0",
      houseEdge: "20.0",
      isLive: true,
      enabled: true,
      config: { minBet: "0.10", maxBet: "5000", maxMultiplier: 1000 },
      thumbnailUrl: "/games/crash.jpg",
    },
  });

  const roulette = await prisma.game.upsert({
    where: { slug: "roulette-european" },
    update: {
      rtp: "80.0",
      houseEdge: "20.0",
      thumbnailUrl: "/games/roulette.jpg",
    },
    create: {
      slug: "roulette-european",
      name: "European Roulette",
      category: GameCategory.roulette,
      rtp: "80.0",
      houseEdge: "20.0",
      isLive: false,
      enabled: true,
      config: { minBet: "0.50", maxBet: "5000", maxMultiplier: 36 },
      thumbnailUrl: "/games/roulette.jpg",
    },
  });

  const blackjack = await prisma.game.upsert({
    where: { slug: "blackjack-az" },
    update: {
      rtp: "80.0",
      houseEdge: "20.0",
      thumbnailUrl: "/games/blackjack.jpg",
    },
    create: {
      slug: "blackjack-az",
      name: "Blackjack AZ",
      category: GameCategory.blackjack,
      rtp: "80.0",
      houseEdge: "20.0",
      isLive: false,
      enabled: true,
      config: { minBet: "1.00", maxBet: "10000", maxMultiplier: 2.5 },
      thumbnailUrl: "/games/blackjack.jpg",
    },
  });

  const slots = await prisma.game.upsert({
    where: { slug: "slots-nova" },
    update: {
      rtp: "80.0",
      houseEdge: "20.0",
      thumbnailUrl: "/games/slots.jpg",
    },
    create: {
      slug: "slots-nova",
      name: "Nova Slots",
      category: GameCategory.slots,
      rtp: "80.0",
      houseEdge: "20.0",
      isLive: false,
      enabled: true,
      config: { minBet: "0.05", maxBet: "500", maxMultiplier: 400 },
      thumbnailUrl: "/games/slots.jpg",
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

  console.log("Seed complete:", { admin: admin.email, wallet: wallet.id, games: [dice.slug, crash.slug, roulette.slug, blackjack.slug, slots.slug] });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
