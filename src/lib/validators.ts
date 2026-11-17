import { z } from "zod";
import type { SeriesFormat } from "./types";

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Name needs at least 2 characters.")
  .max(20, "Name can be at most 20 characters.")
  .regex(/^[A-Za-z0-9][A-Za-z0-9 .'_-]*$/, "Use letters, numbers, spaces, and . ' _ -")
  .transform((value) => value.replace(/\s+/g, " "));

export const pinSchema = z.string().regex(/^\d{4,8}$/, "PIN must be 4–8 digits.");

export const logoUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || /^https:\/\/\S+$/i.test(value), "Logo URL must start with https://")
  .transform((value) => (value === "" ? null : value));

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function scoresForWinner(input: {
  format: SeriesFormat;
  winnerId: string;
  teamAId: string;
  teamBId: string;
  margin: "2-0" | "2-1" | null;
}): { scoreA: number; scoreB: number } {
  if (input.winnerId !== input.teamAId && input.winnerId !== input.teamBId) {
    throw new Error("Winner must be one of the teams.");
  }
  const winnerIsA = input.winnerId === input.teamAId;
  if (input.format === "bo1") {
    return { scoreA: winnerIsA ? 1 : 0, scoreB: winnerIsA ? 0 : 1 };
  }
  if (input.margin !== "2-0" && input.margin !== "2-1") {
    throw new Error("Bo3 results need a 2-0 or 2-1 score.");
  }
  const loserMaps = input.margin === "2-0" ? 0 : 1;
  return winnerIsA ? { scoreA: 2, scoreB: loserMaps } : { scoreA: loserMaps, scoreB: 2 };
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}
