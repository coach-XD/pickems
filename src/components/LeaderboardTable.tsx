import Link from "next/link";
import { formatRank } from "@/lib/ranking";
import type { RankedScore } from "@/lib/ranking";
import { cardClass, cx } from "@/lib/ui";

export function LeaderboardTable({
  rows,
  youId,
  stageSlug,
  gains,
}: {
  rows: RankedScore[];
  youId: string;
  stageSlug: string;
  gains?: Map<string, number>;
}) {
  if (rows.length === 0) {
    return <p className={`${cardClass} p-4 text-sm text-zinc-400`}>Nobody has joined yet.</p>;
  }
  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div className="grid grid-cols-[2.4rem_minmax(0,1fr)_4.6rem] gap-2 border-b border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:grid-cols-[3rem_minmax(0,1fr)_4.5rem_4.5rem_4.5rem_5.5rem] sm:text-xs">
        <span>Rank</span>
        <span>Name</span>
        <span className="hidden text-right sm:block">Match</span>
        <span className="hidden text-right sm:block">Maps</span>
        <span className="hidden text-right sm:block">Place</span>
        <span className="text-right">Total</span>
      </div>
      <ol>
        {rows.map((row) => {
          const you = row.playerId === youId;
          const gain = gains?.get(row.playerId) ?? 0;
          return (
            <li
              key={row.playerId}
              className={cx(
                "grid grid-cols-[2.4rem_minmax(0,1fr)_4.6rem] items-center gap-2 border-b border-white/5 px-3 py-2.5 last:border-b-0 sm:grid-cols-[3rem_minmax(0,1fr)_4.5rem_4.5rem_4.5rem_5.5rem]",
                you && "bg-amber-400/10",
              )}
            >
              <span className="font-mono text-sm text-amber-200">{formatRank(row.rank)}</span>
              <Link href={`/players/${row.playerId}?stage=${stageSlug}`} className="truncate font-semibold hover:text-amber-200">
                {row.name}
                {you ? <span className="ml-2 text-xs font-medium text-amber-200">you</span> : null}
              </Link>
              <span className="hidden text-right text-sm tabular-nums text-zinc-300 sm:block">{row.matchPoints}</span>
              <span className="hidden text-right text-sm tabular-nums text-zinc-300 sm:block">{row.mapPoints}</span>
              <span className="hidden text-right text-sm tabular-nums text-zinc-300 sm:block">{row.placementPoints}</span>
              <span className="text-right text-base font-semibold tabular-nums">
                {row.total}
                {gain > 0 ? <span className="ml-1 text-xs font-semibold text-emerald-300">+{gain}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
