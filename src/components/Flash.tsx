import { flashMessage } from "@/lib/flash";

export function Flash({ error, notice }: { error?: string; notice?: string }) {
  const message = error ? flashMessage(error) : notice ? flashMessage(notice) : null;
  if (!message) return null;
  const bad = Boolean(error);
  return (
    <p
      role={bad ? "alert" : "status"}
      className={`rounded-xl border px-3 py-2 text-sm ${bad ? "border-rose-400/40 bg-rose-500/10 text-rose-100" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"}`}
    >
      {message}
    </p>
  );
}
