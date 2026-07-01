import { hashServerSeed } from "../../index.js";
import { deriveBustMultiplier } from "../engine/math.js";

/**
 * Verifies that a settled Crash round's result was fair by re-calculating the 
 * bust multiplier from the revealed server seed and client parameters.
 */
export function verifyCrashRound(
  serverSeed: string,
  serverSeedHash: string,
  clientSeed: string,
  nonce: number,
  expectedBustMultiplier: number,
  houseEdgeBps: number = 150
): boolean {
  // Verify server seed hash matches commitment
  const computedHash = hashServerSeed(serverSeed);
  if (computedHash !== serverSeedHash) return false;

  // Re-derive the bust multiplier
  const derived = deriveBustMultiplier(serverSeed, clientSeed, nonce, houseEdgeBps);
  
  // Verify it matches the recorded round multiplier
  return Math.abs(derived - expectedBustMultiplier) < 0.0001;
}
