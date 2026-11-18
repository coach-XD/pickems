export function Rules() {
  return (
    <details className="rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300">
      <summary className="cursor-pointer font-semibold text-zinc-100">Scoring and locks</summary>
      <ul className="mt-3 space-y-1.5 text-[13px] leading-5 text-zinc-400">
        <li>Click winners on the bracket. The 3-0s, 0-3s, and the other advancers are read off that bracket.</li>
        <li>1 point when your winner matches the real series, and only if those two teams actually play.</li>
        <li>1 extra point for the exact Bo3 map score, and only if the winner is also right. Bo1 has no map bonus.</li>
        <li>5 points for each correct 3-0, and 5 for each correct 0-3. A 3-0 team that only advances scores 0 in that slot.</li>
        <li>2 points for each of the other six teams that advance, at any record.</li>
        <li>No upset bonus. Each stage is scored on its own, and the overall board adds the real stages.</li>
        <li>Equal totals share a rank. Two people on the same score are both 1, and the next person is 3.</li>
        <li>The whole bracket locks one hour before the first Round 1 match. After that it is read-only, with real results in green or red.</li>
      </ul>
    </details>
  );
}