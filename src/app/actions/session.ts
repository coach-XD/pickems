"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { players } from "@/db/schema";
import {
  clearAdminCookie,
  clearPlayerCookie,
  inviteMatches,
  setAdminCookie,
  setDemoCookie,
  setPlayerCookie,
} from "@/lib/auth";
import { hashPin, nameKey, safeEqual, verifyPin } from "@/lib/secrets";
import { displayNameSchema, pinSchema } from "@/lib/validators";
import { isUniqueViolation } from "@/lib/validators";

function bounce(path: string, code: string): never {
  const join = path.includes("?") ? "&" : "?";
  redirect(`${path}${join}error=${encodeURIComponent(code)}`);
}

export async function joinPool(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const back = `/join/${encodeURIComponent(token)}`;
  if (!process.env.INVITE_TOKEN) bounce(back, "invite-missing");
  if (!inviteMatches(token)) bounce(back, "invite");

  const name = displayNameSchema.safeParse(String(formData.get("name") ?? ""));
  const pin = pinSchema.safeParse(String(formData.get("pin") ?? ""));
  if (!name.success || !pin.success) bounce(back, "join");

  const key = nameKey(name.data);
  const db = getDb();
  const [existing] = await db.select().from(players).where(eq(players.displayNameKey, key)).limit(1);
  if (existing) {
    const matches = await verifyPin(pin.data, existing.pinHash);
    if (!matches) bounce(back, "pin");
    await setPlayerCookie(existing.id);
    redirect("/");
  }

  try {
    const [created] = await db
      .insert(players)
      .values({
        displayName: name.data,
        displayNameKey: key,
        pinHash: await hashPin(pin.data),
        isDemo: false,
      })
      .returning();
    await setPlayerCookie(created.id);
  } catch (error) {
    if (isUniqueViolation(error)) bounce(back, "pin");
    throw error;
  }
  redirect("/");
}

export async function signOut() {
  await clearPlayerCookie();
  redirect("/");
}

export async function adminLogin(formData: FormData) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) bounce("/admin/login", "admin-missing");
  const password = String(formData.get("password") ?? "");
  if (!safeEqual(password, expected)) bounce("/admin/login", "admin-auth");
  await setAdminCookie();
  redirect("/admin");
}

export async function adminLogout() {
  await clearAdminCookie();
  redirect("/admin/login");
}

export async function setSampleVisibility(formData: FormData) {
  const on = String(formData.get("on") ?? "") === "1";
  await setDemoCookie(on);
  redirect(on ? "/?view=demo-stage" : "/?view=overall");
}
