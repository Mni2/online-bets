import crypto from "crypto";

function base32ToBytes(base32: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = base32.toUpperCase().replace(/=+$/, "");
  let bits = "";
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) throw new Error("Invalid base32 character");
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTOTP(secret: string, timeStep = 30): string {
  const key = base32ToBytes(secret);
  const time = Math.floor(Date.now() / 1000 / timeStep);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(time));

  const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 1000000).toString().padStart(6, "0");
}

export function verifyTOTP(token: string, secret: string, window = 1): boolean {
  try {
    const key = base32ToBytes(secret);
    const currentTime = Math.floor(Date.now() / 1000 / 30);

    for (let i = -window; i <= window; i++) {
      const time = currentTime + i;
      const buffer = Buffer.alloc(8);
      buffer.writeBigInt64BE(BigInt(time));

      const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
      const offset = hmac[hmac.length - 1] & 0xf;
      const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

      const otp = (binary % 1000000).toString().padStart(6, "0");
      if (otp === token) return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function generateTOTPSecret(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = crypto.randomBytes(10);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += bytes[i].toString(2).padStart(8, "0");
  }
  let secret = "";
  for (let i = 0; i < bin.length; i += 5) {
    const chunk = bin.slice(i, i + 5);
    const index = parseInt(chunk, 2);
    secret += alphabet[index];
  }
  return secret;
}

export function generateOTPCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}
