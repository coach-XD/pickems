export const inputClass =
  "h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-zinc-100 outline-none ring-amber-400/70 placeholder:text-zinc-600 focus:ring-2";

export const selectClass =
  "h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 text-sm text-zinc-100 outline-none ring-amber-400/70 focus:ring-2";

export const btnPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-45";

export const btnGhost =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-zinc-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45";

export const btnDanger =
  "inline-flex h-11 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20";

export const cardClass =
  "rounded-2xl border border-white/10 bg-zinc-900/75 shadow-[0_24px_50px_-36px_rgba(0,0,0,0.9)]";

export const labelClass = "mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-400";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
