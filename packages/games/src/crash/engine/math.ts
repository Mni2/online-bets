import crypto from "node:crypto";
import { compareDecimal, hmacSha256 } from "@nova/shared";

// Growth rate: multiplier = e^(0.06 * seconds)
export const GROWTH_RATE = 0.06;

/**
 * Calculates the current multiplier based on elapsed time (seconds) since round started
 */
export function getMultiplierAtTime(elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 1.00;
  const mult = Math.pow(Math.E, GROWTH_RATE * elapsedSeconds);
  // Floor to 2 decimal places to match business requirement
  return Math.max(1.00, Math.floor(mult * 100) / 100);
}

/**
 * Derives the pre-determined bust multiplier from the server seed, client seed, and nonce
 * using HMAC-SHA256, ensuring a strict House Edge.
 * 
 * @param serverSeed Cryptographically secure server seed
 * @param clientSeed Client seed contribution
 * @param nonce Round number
 * @param houseEdgeBps House edge in basis points (e.g. 150 = 1.5%)
 */
export function deriveBustMultiplier(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  houseEdgeBps: number = 150
): number {
  // HMAC-SHA256 of serverSeed and "clientSeed:nonce"
  const hash = hmacSha256(serverSeed, `${clientSeed}:${nonce}`);
  
  // Use first 13 hex characters (52 bits) for high entropy
  const num = parseInt(hash.slice(0, 13), 16);
  const X = num / Math.pow(2, 52); // Uniform distribution [0, 1)

  const E = houseEdgeBps / 10000; // House edge percentage as decimal (e.g., 0.015)

  // If X is less than the house edge, the game busts instantly at 1.00x
  if (X < E) {
    return 1.00;
  }

  // Otherwise calculate Pareto distribution bust multiplier
  const multiplier = (100 - E * 100) / (100 * (1 - X));
  
  // Return multiplier floored to 2 decimal places, minimum 1.00
  return Math.max(1.00, Math.floor(multiplier * 100) / 100);
}
