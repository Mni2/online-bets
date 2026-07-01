import { randomBytes } from "node:crypto";

export interface AggregatedVendor {
  id: string;
  name: string;
  code: string;
  gamesCount: number;
  avgRtp: number;
  status: "active" | "maintenance";
  integrationType: "SeamlessWallet" | "DirectAPI" | "InHouse";
  logoUrl: string;
}

export const AGGREGATED_VENDORS: AggregatedVendor[] = [
  {
    id: "v-1",
    name: "Nova Studio Originals",
    code: "NOVA",
    gamesCount: 5,
    avgRtp: 80.0,
    status: "active",
    integrationType: "InHouse",
    logoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "v-2",
    name: "Evolution Gaming VIP",
    code: "EVO",
    gamesCount: 12,
    avgRtp: 80.0,
    status: "active",
    integrationType: "SeamlessWallet",
    logoUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "v-3",
    name: "Pragmatic Play Live & Slots",
    code: "PRAG",
    gamesCount: 24,
    avgRtp: 80.0,
    status: "active",
    integrationType: "SeamlessWallet",
    logoUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "v-4",
    name: "Ezugi Grand Tables",
    code: "EZUGI",
    gamesCount: 8,
    avgRtp: 80.0,
    status: "active",
    integrationType: "SeamlessWallet",
    logoUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=100&auto=format&fit=crop&q=80",
  },
  {
    id: "v-5",
    name: "Nova Sports Feed API",
    code: "SPORTS",
    gamesCount: 40,
    avgRtp: 80.0,
    status: "active",
    integrationType: "DirectAPI",
    logoUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100&auto=format&fit=crop&q=80",
  },
];

export interface AggregatedGame {
  id: string;
  slug: string;
  title: string;
  vendorCode: string;
  vendorName: string;
  category: "dice" | "crash" | "roulette" | "blackjack" | "slots" | "live" | "sports";
  rtp: number;
  houseEdge: number;
  volatility: "Low" | "Medium" | "High" | "Extreme";
  thumbnailUrl: string;
  isLive: boolean;
  minBet: string;
  maxBet: string;
  maxMultiplier: number;
}

export const AGGREGATED_CATALOG: AggregatedGame[] = [
  {
    id: "agg-1",
    slug: "crash-arcade",
    title: "Crash Arcade (Flying Kite)",
    vendorCode: "NOVA",
    vendorName: "Nova Studio Originals",
    category: "crash",
    rtp: 80.0,
    houseEdge: 20.0,
    volatility: "High",
    thumbnailUrl: "/games/crash.jpg",
    isLive: true,
    minBet: "0.10",
    maxBet: "5000.00",
    maxMultiplier: 1000,
  },
  {
    id: "agg-2",
    slug: "roulette-european",
    title: "European Roulette VIP",
    vendorCode: "NOVA",
    vendorName: "Nova Studio Originals",
    category: "roulette",
    rtp: 80.0,
    houseEdge: 20.0,
    volatility: "Medium",
    thumbnailUrl: "/games/roulette.jpg",
    isLive: false,
    minBet: "0.50",
    maxBet: "5000.00",
    maxMultiplier: 36,
  },
  {
    id: "agg-3",
    slug: "blackjack-az",
    title: "Blackjack AZ Table",
    vendorCode: "NOVA",
    vendorName: "Nova Studio Originals",
    category: "blackjack",
    rtp: 80.0,
    houseEdge: 20.0,
    volatility: "Low",
    thumbnailUrl: "/games/blackjack.jpg",
    isLive: false,
    minBet: "1.00",
    maxBet: "10000.00",
    maxMultiplier: 2.5,
  },
  {
    id: "agg-4",
    slug: "slots-nova",
    title: "Nova Slots (5x3 Neon)",
    vendorCode: "NOVA",
    vendorName: "Nova Studio Originals",
    category: "slots",
    rtp: 80.0,
    houseEdge: 20.0,
    volatility: "High",
    thumbnailUrl: "/games/slots.jpg",
    isLive: false,
    minBet: "0.05",
    maxBet: "500.00",
    maxMultiplier: 400,
  },
  {
    id: "agg-5",
    slug: "dice-100",
    title: "Dice 100 Originals",
    vendorCode: "NOVA",
    vendorName: "Nova Studio Originals",
    category: "dice",
    rtp: 80.0,
    houseEdge: 20.0,
    volatility: "Low",
    thumbnailUrl: "/games/dice.jpg",
    isLive: false,
    minBet: "0.10",
    maxBet: "10000.00",
    maxMultiplier: 99,
  },
  {
    id: "agg-6",
    slug: "live-vip-roulette",
    name: "Monte Carlo VIP Roulette",
    title: "Monte Carlo VIP Roulette (Dealer: Elena)",
    vendorCode: "EVO",
    vendorName: "Evolution Gaming VIP",
    category: "live",
    rtp: 80.0,
    houseEdge: 20.0,
    volatility: "Medium",
    thumbnailUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80",
    isLive: true,
    minBet: "1.00",
    maxBet: "10000.00",
    maxMultiplier: 36,
  } as any,
  {
    id: "agg-7",
    slug: "live-vip-blackjack",
    title: "Grand Casino VIP Blackjack (Dealer: Victoria)",
    vendorCode: "PRAG",
    vendorName: "Pragmatic Play Live & Slots",
    category: "live",
    rtp: 80.0,
    houseEdge: 20.0,
    volatility: "Low",
    thumbnailUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=80",
    isLive: true,
    minBet: "5.00",
    maxBet: "25000.00",
    maxMultiplier: 2.5,
  },
  {
    id: "agg-8",
    slug: "live-highroller-baccarat",
    title: "Imperial High-Roller Baccarat (Dealer: Sophia)",
    vendorCode: "EZUGI",
    vendorName: "Ezugi Grand Tables",
    category: "live",
    rtp: 80.0,
    houseEdge: 20.0,
    volatility: "Low",
    thumbnailUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=80",
    isLive: true,
    minBet: "10.00",
    maxBet: "50000.00",
    maxMultiplier: 8,
  },
  {
    id: "agg-9",
    slug: "live-cyber-show",
    title: "Cyber Fortune Live Game Show (Dealer: Chloe)",
    vendorCode: "NOVA",
    vendorName: "Nova Studio Originals",
    category: "live",
    rtp: 80.0,
    houseEdge: 20.0,
    volatility: "Extreme",
    thumbnailUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&auto=format&fit=crop&q=80",
    isLive: true,
    minBet: "0.50",
    maxBet: "5000.00",
    maxMultiplier: 1000,
  },
];

export interface AggregatorFilter {
  vendor?: string;
  category?: string;
  search?: string;
  minRtp?: number;
}

export const filterCatalog = (filter: AggregatorFilter = {}): AggregatedGame[] => {
  return AGGREGATED_CATALOG.filter((g) => {
    if (filter.vendor && filter.vendor !== "ALL" && g.vendorCode !== filter.vendor) return false;
    if (filter.category && filter.category !== "ALL" && g.category !== filter.category) return false;
    if (filter.search && !g.title.toLowerCase().includes(filter.search.toLowerCase())) return false;
    if (filter.minRtp && g.rtp < filter.minRtp) return false;
    return true;
  });
};

export interface EnterpriseStats {
  totalCatalogSize: number;
  activeVendors: number;
  platformRtpCompliance: string;
  totalMonthlyVolumeUsd: string;
  operatorGgrUsd: string;
  activePlayerSessions: number;
  systemHealth: "Optimal" | "Degraded" | "Maintenance";
}

export const getAggregatorStats = (): EnterpriseStats => {
  return {
    totalCatalogSize: AGGREGATED_CATALOG.length + 80, // aggregated games across all studio pipes
    activeVendors: AGGREGATED_VENDORS.length,
    platformRtpCompliance: "100% Verified (80.0% RTP / 20.0% Vig)",
    totalMonthlyVolumeUsd: "$48,250,910.40",
    operatorGgrUsd: "$9,650,182.08 (20% House Edge)",
    activePlayerSessions: 3412,
    systemHealth: "Optimal",
  };
};

export const launchAggregatedGame = (slug: string, userId: string, currency: string = "USD"): { sessionToken: string; launchUrl: string; vendor: string; title: string } => {
  const game = AGGREGATED_CATALOG.find((g) => g.slug === slug) ?? AGGREGATED_CATALOG[0]!;
  const sessionToken = randomBytes(16).toString("hex");
  const launchUrl = `/games/${game.category === "live" ? "live" : game.category}?session=${sessionToken}&game=${game.slug}`;
  return {
    sessionToken,
    launchUrl,
    vendor: game.vendorName,
    title: game.title,
  };
};
