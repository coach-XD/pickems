/** HLTV Rating 3.0 bands. Red at or below redMax, yellow through yellowMax, green above that. */
export const RATING_BANDS = {
  redMax: 0.96,
  yellowMax: 1.05,
} as const;

export type RatingTone = "red" | "yellow" | "green" | "muted";

export function ratingTone(rating: number | null | undefined): RatingTone {
  if (rating == null || !Number.isFinite(rating)) return "muted";
  if (rating <= RATING_BANDS.redMax) return "red";
  if (rating <= RATING_BANDS.yellowMax) return "yellow";
  return "green";
}

export function ratingClass(tone: RatingTone): string {
  if (tone === "red") return "text-rose-400";
  if (tone === "yellow") return "text-amber-300";
  if (tone === "green") return "text-emerald-400";
  return "text-zinc-600";
}

export function formatRating(rating: number | null | undefined): string {
  if (rating == null || !Number.isFinite(rating)) return "–";
  return rating.toFixed(2);
}
