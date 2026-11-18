import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { players } from "@/db/schema";
import { safeEqual, signValue, verifyValue } from "./secrets";

const PLAYER_COOKIE = "pickem_player";
const ADMIN_COOKIE = "pickem_admin";
const DEMO_COOKIE = "pickem_demo";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const YEAR = 60 * 60 * 24 * 400;

async function cookieOptions(maxAge: number) {
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto");
  const secure = proto ? proto.split(",")[0].trim() === "https" : process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge,
  };
}

export async function setPlayerCookie(playerId: string) {
  const secret = process.env.INVITE_TOKEN;
  if (!secret) throw new Error("INVITE_TOKEN is not set.");
  const jar = await cookies();
  jar.set(PLAYER_COOKIE, signValue(playerId, secret), await cookieOptions(YEAR));
}

export async function clearPlayerCookie() {
  const jar = await cookies();
  jar.delete(PLAYER_COOKIE);
}

export async function setAdminCookie() {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error("ADMIN_PASSWORD is not set.");
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, signValue("admin", secret), await cookieOptions(60 * 60 * 24 * 14));
}

export async function clearAdminCookie() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export async function setDemoCookie(on: boolean) {
  const jar = await cookies();
  if (on) jar.set(DEMO_COOKIE, "1", await cookieOptions(YEAR));
  else jar.delete(DEMO_COOKIE);
}

export async function demoCookieOn(): Promise<boolean> {
  const jar = await cookies();
  return jar.get(DEMO_COOKIE)?.value === "1";
}

export async function getSessionPlayer() {
  const secret = process.env.INVITE_TOKEN;
  if (!secret) return null;
  const jar = await cookies();
  const raw = jar.get(PLAYER_COOKIE)?.value;
  if (!raw) return null;
  const id = verifyValue(raw, secret);
  if (!id || !UUID_RE.test(id)) return null;
  const [player] = await getDb().select().from(players).where(eq(players.id, id)).limit(1);
  return player ?? null;
}

export async function isAdmin(): Promise<boolean> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const jar = await cookies();
  const raw = jar.get(ADMIN_COOKIE)?.value;
  if (!raw) return false;
  return verifyValue(raw, secret) === "admin";
}

export function inviteMatches(token: string): boolean {
  const expected = process.env.INVITE_TOKEN;
  if (!expected) return false;
  return safeEqual(token, expected);
}
