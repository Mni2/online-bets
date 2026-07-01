import { deriveBustMultiplier, getMultiplierAtTime } from "../engine/math.js";
import { verifyCrashRound } from "../provably-fair/verification.js";
import { hashServerSeed } from "../../index.js";

// Simple custom test runner assert helper
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function runCrashTests() {
  console.log("=== RUNNING CRASH GAME ENGINE TESTS ===");

  // Test Case 1: Multiplier Growth Curve
  console.log("Testing growth curve multiplier at times...");
  assert(getMultiplierAtTime(0) === 1.00, "0s should yield 1.00x");
  assert(getMultiplierAtTime(-5) === 1.00, "Negative time should yield 1.00x");
  assert(getMultiplierAtTime(10) > 1.80 && getMultiplierAtTime(10) < 1.83, "10s should yield ~1.82x");
  console.log("  Pass: growth curve matches expectation.");

  // Test Case 2: Bust Multiplier Derivation
  console.log("Testing bust multiplier derivation from seed...");
  const serverSeed = "abc123serverseedhexstring";
  const clientSeed = "clientseed";
  const nonce = 5;
  
  const mult = deriveBustMultiplier(serverSeed, clientSeed, nonce, 150); // 1.5% house edge
  assert(mult >= 1.00, "Derived multiplier must be at least 1.00");
  console.log(`  Pass: Derived multiplier for test seeds = ${mult}x`);

  // Test Case 3: Provably Fair Verification
  console.log("Testing provably fair verification...");
  const serverSeed2 = "66ee8e0fa800b4685ff1ff456e4c760a5e8de9fb3e89a3f2d2f3cd2e84d4b1a4";
  const serverSeedHash2 = hashServerSeed(serverSeed2);
  const clientSeed2 = "my-client-seed";
  const nonce2 = 12;

  const derivedMult = deriveBustMultiplier(serverSeed2, clientSeed2, nonce2, 150);
  const isValid = verifyCrashRound(
    serverSeed2,
    serverSeedHash2,
    clientSeed2,
    nonce2,
    derivedMult,
    150
  );
  assert(isValid, "verifyCrashRound should return true for matching seeds");

  const isInvalid = verifyCrashRound(
    serverSeed2,
    "incorrect_hash",
    clientSeed2,
    nonce2,
    derivedMult,
    150
  );
  assert(!isInvalid, "verifyCrashRound should return false for mismatching server seed hash");

  console.log("  Pass: Provably fair verification correct.");
  console.log("=== ALL CRASH TESTS PASSED ===");
}
