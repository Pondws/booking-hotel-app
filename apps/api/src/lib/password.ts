import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const COST_N = 131072; // 2^17
const COST_R = 8;
const COST_P = 1;

function scryptAsync(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_BYTES,
      { N: n, r, p, maxmem: 128 * n * r * 2 },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scryptAsync(plain, salt, COST_N, COST_R, COST_P);
  return `scrypt$${COST_N}$${COST_R}$${COST_P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

function parsePositiveInt(value: string): number | null {
  if (!/^[1-9][0-9]*$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
    const n = parsePositiveInt(nStr);
    const r = parsePositiveInt(rStr);
    const p = parsePositiveInt(pStr);
    if (n === null || r === null || p === null) return false;
    if (n < 2 || (n & (n - 1)) !== 0 || n > COST_N) return false;
    if (r > 32 || p > 16) return false;
    if (!/^[0-9a-f]{32}$/.test(saltHex) || !/^[0-9a-f]{128}$/.test(hashHex)) return false;
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scryptAsync(plain, Buffer.from(saltHex, "hex"), n, r, p);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
