"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Pick&apos;em</p>
      <h1 className="mt-2 text-3xl font-semibold">The board didn&apos;t load</h1>
      <p className="mt-3 text-sm text-zinc-400">Check the database connection, then try again.</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-amber-400 px-4 text-sm font-semibold text-zinc-950"
      >
        Try again
      </button>
    </main>
  );
}
