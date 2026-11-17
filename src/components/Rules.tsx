export function Rules() {
  return (
    <details className="rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300">
      <summary className="cursor-pointer font-semibold text-zinc-100">Scoring and locks</summary>
      <ul className="mt-3 space-y-1.5 text-[13px] leading-5 text-zinc-400">
        <li>1 point for the correct match winner.</li>
        <li>1 extra point for the exact Bo3 map score, and only if the winner is right. Bo1 has no map bonus.</li>
        <li>5 points for each correct 3-0, and 5 for each correct 0-3.</li>
        <li>A 3-0 pick that advances 3-1 or 3-2 scores 0. An 0-3 pick that goes out 1-3 or 2-3 scores 0.</li>
        <li>2 points for each advancing team in the six advance slots, at any record.</li>
        <li>No upset bonus. Each stage is scored on its own, and the overall board adds them up.</li>
        <li>Ties break by most correct placement picks. Still tied means a shared rank, shown as T-2.</li>
        <li>Stage picks lock one hour before the first match. Each series locks one hour before it starts. Other people&apos;s picks show up after that lock.</li>
      </ul>
    </details>
  );
}
