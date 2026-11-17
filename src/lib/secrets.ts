import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export function signValue(value: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${mac}`;
}

export function verifyValue(token: string, secret: string): string | null {
  const splitAt = token.lastIndexOf(".");
  if (splitAt <= 0) return null;
  const value = token.slice(0, splitAt);
  const mac = token.slice(splitAt + 1);
  const expected = createHmac("sha256", secret).update(value).digest("base64url");
  const actual = Buffer.from(mac);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  return value;
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(pin, salt, 32)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [algo, salt, hex] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hex) return false;
  const derived = (await scryptAsync(pin, salt, 32)) as Buffer;
  const actual = Buffer.from(hex, "hex");
  if (actual.length !== derived.length) return false;
  return timingSafeEqual(actual, derived);
}

export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
