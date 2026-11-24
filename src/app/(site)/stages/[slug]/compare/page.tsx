import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { derivedPlacements, enteringPools, projectBracket } from "@/lib/bracket";
import { demoCookieOn, getSessionPlayer } from "@/lib/auth";
import { allowDemoData } from "@/lib/logos";
import { getLeaderboard, getStageBySlug, listBrackets, listStages, pointsSinceLastResult, stageBundle } from "@/lib/queries";
import { gradePlacementPick, gradeRealMatch, type PickTone } from "@/lib/results";
import { pairKey } from "@/lib/swiss";
import { earliest, isLocked } from "@/lib/time";
import { SLOT_LABEL, type Slot } from "@/lib/types";
import { cx } from "@/lib/ui";

export const metadata = { title: "Compare" };

const toneClass: Record<PickTone | "hidden", string> = {
  correct: "bg-emerald-500/25 text-emerald-100",
  wrong: "bg-rose-500/20 text-rose-100",
  pending: "bg-zinc-800/80 text-zinc-400",
  empty: "bg-zinc-900 text-zinc-600",
  hidden: "bg-zinc-900 text-zinc-600",
};

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const { slug } = await params;
  const includeDemo = allowDemoData() && (player.isDemo || (await demoCookieOn()));
  const stage = await getStageBySlug(slug);
  if (!stage || (stage.isDemo && !includeDemo)) notFound();

  const bundle = await stageBundle(stage.id);
  const stages = await listStages(includeDemo);
  const realStageIds = stages.filter((item) => !item.isDemo).map((item) => item.id);
  const [board, overall, stageGains, overallGains, brackets] = await Promise.all([
    getLeaderboard([stage.id], stage.isDemo),
    getLeaderboard(stage.isDemo ? [stage.id] : realStageIds, stage.isDemo),
    pointsSinceLastResult([stage.id]),
    pointsSinceLastResult(stage.isDemo ? [stage.id] : realStageIds),
    listBrackets(stage.id),
  ]);
  const round1 = bundle.matches.filter((match) => match.round === 1).map((match) => ({ teamAId: match.teamAId, teamBId: match.teamBId }));
  const teams = bundle.teams.map((team) => ({ teamId: team.teamId, seed: team.seed }));
  const slateLocked = isLocked(earliest(bundle.matches.filter((match) => match.round === 1).map((match) => match.scheduledAt), stage.startsAt), new Date());
  const teamName = new Map(bundle.teams.map((team) => [team.teamId, team.shortName]));
  const records = new Map(bundle.standings.map((row) => [row.teamId, { wins: row.wins, losses: row.losses }]));
  const pools = enteringPools(bundle.matches);

  const projected = new Map(
    board.map((entry) => {
      const stored = brackets.find((row) => row.playerId === entry.playerId);
      const matches = projectBracket({ teams, round1, picks: stored?.picks ?? [] });
      const slots = new Map<string, Slot>(derivedPlacements(teams, matches).map((slot) => [slot.teamId, slot.slot]));
      const byPair = new Map(matches.filter((match) => match.winnerId).map((match) => [pairKey(match.teamAId, match.teamBId), match]));
      return [entry.playerId, { slots, byPair }] as const;
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/picks?stage=${stage.slug}`} className="text-xs font-semibold text-zinc-500">
          Back to your bracket
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{stage.name}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {slateLocked ? "Brackets are locked, so every pick is visible." : "Other brackets stay hidden until the lock."} A pick scores only when the real match is the same round and the same record. Green is a right winner, red is a miss, grey is still pending. +N is the points from the latest saved result.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">This stage</h2>
        <LeaderboardTable rows={board} youId={player.id} stageSlug={stage.slug} gains={stageGains} />
      </section>
      {stage.isDemo ? null : (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">Overall</h2>
          <LeaderboardTable rows={overall} youId={player.id} stageSlug={stage.slug} gains={overallGains} />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">Picks</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr>
                <th className="freeze-col border-b border-white/10 px-3 py-2 font-medium text-zinc-400">Player</th>
                {bundle.matches.map((match) => (
                  <th key={match.id} className="min-w-24 border-b border-white/10 px-2 py-2 font-medium text-zinc-300">
                    <span className="block text-[10px] text-zinc-500">R{match.round}</span>
                    {match.teamAShort}–{match.teamBShort}
                    <span className="mt-0.5 block text-[10px] font-normal text-zinc-500">
                      {match.winnerId ? `${match.scoreA}-${match.scoreB}` : "Pending"}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.map((entry) => {
                const hidden = entry.playerId !== player.id && !slateLocked;
                return (
                  <tr key={entry.playerId}>
                    <th className="freeze-col border-b border-white/5 px-3 py-2 text-left font-medium text-zinc-200">
                      <Link href={`/players/${entry.playerId}?stage=${stage.slug}`} className="hover:text-amber-200">
                        {entry.name}
                      </Link>
                    </th>
                    {bundle.matches.map((match) => {
                      const cell = hidden ? null : gradeCell(projected.get(entry.playerId)?.byPair.get(pairKey(match.teamAId, match.teamBId)), match, pools, teamName);
                      const tone = hidden ? "hidden" : (cell?.tone ?? "empty");
                      return (
                        <td key={match.id} className={cx("border-b border-white/5 px-2 py-2 align-top", toneClass[tone])}>
                          {hidden ? (
                            "Hidden"
                          ) : (
                            <>
                              <span className="block font-semibold">{cell?.label}</span>
                              <span className="block text-[10px]">{cell?.detail}</span>
                            </>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">Results</h2>
        {bundle.matches.map((match) => (
          <article key={match.id} className="max-w-3xl rounded-2xl border border-white/10 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">
                R{match.round} {match.teamAShort} vs {match.teamBShort}
              </h3>
              <p className={cx("text-sm font-semibold", match.winnerId ? "text-white" : "text-zinc-500")}>
                {match.winnerId ? `Final ${match.scoreA}-${match.scoreB}` : "Pending"}
              </p>
            </div>
            <ul className="mt-2 divide-y divide-white/5">
              {board.map((entry) => {
                const hidden = entry.playerId !== player.id && !slateLocked;
                if (hidden) {
                  return (
                    <li key={entry.playerId} className="flex items-center justify-between gap-3 py-1.5 text-sm text-zinc-500">
                      <span>{entry.name}</span>
                      <span>Hidden</span>
                    </li>
                  );
                }
                const cell = gradeCell(projected.get(entry.playerId)?.byPair.get(pairKey(match.teamAId, match.teamBId)), match, pools, teamName);
                return (
                  <li key={entry.playerId} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <span className="font-medium">{entry.name}</span>
                    <span className={cx("text-right", toneClass[cell.tone], "rounded-full px-2 py-0.5")}>
                      {cell.label} · {cell.detail}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">3-0, 0-3, and advance</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr>
                <th className="freeze-col border-b border-white/10 px-3 py-2 font-medium text-zinc-400">Team</th>
                {board.map((entry) => (
                  <th key={entry.playerId} className="border-b border-white/10 px-3 py-2 font-medium text-zinc-300">
                    {entry.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bundle.teams.map((team) => (
                <tr key={team.teamId}>
                  <th className="freeze-col border-b border-white/5 px-3 py-2 text-left font-medium text-zinc-200">
                    {team.seed}. {team.shortName}
                  </th>
                  {board.map((entry) => {
                    const hidden = entry.playerId !== player.id && !slateLocked;
                    const slot = projected.get(entry.playerId)?.slots.get(team.teamId);
                    const record = records.get(team.teamId) ?? { wins: 0, losses: 0 };
                    const grade = slot ? gradePlacementPick(slot, record.wins, record.losses) : null;
                    return (
                      <td key={entry.playerId} className={cx("border-b border-white/5 px-3 py-2", grade && toneClass[grade.tone])}>
                        {hidden ? "Hidden" : slot ? `${SLOT_LABEL[slot]}${grade?.tone === "pending" ? " · pending" : grade?.tone === "correct" ? ` · +${grade.points}` : grade ? " · 0" : ""}` : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function gradeCell(
  pick: { round: number; wins: number; losses: number; format: "bo1" | "bo3"; teamAId: string; teamBId: string; winnerId: string | null; scoreA: number | null; scoreB: number | null } | undefined,
  match: { round: number; format: "bo1" | "bo3"; teamAId: string; teamBId: string; winnerId: string | null; scoreA: number | null; scoreB: number | null },
  pools: Map<string, { wins: number; losses: number }>,
  teamName: Map<string, string>,
): { tone: PickTone; label: string; detail: string } {
  const grade = gradeRealMatch({
    pick: pick ?? null,
    real: match,
    pool: pools.get(`${match.round}|${pairKey(match.teamAId, match.teamBId)}`) ?? null,
  });
  if (grade.mismatch) return { tone: "wrong", label: "Matchup didn't happen", detail: "0" };
  const picked = pick?.winnerId ? (teamName.get(pick.winnerId) ?? "Pick") : "No pick";
  const margin = pick?.scoreA != null && pick.scoreB != null ? ` ${Math.max(pick.scoreA, pick.scoreB)}-${Math.min(pick.scoreA, pick.scoreB)}` : "";
  const detail =
    grade.tone === "pending" ? "Pending" : grade.tone === "empty" ? "No pick" : grade.exact ? `+${grade.points} exact` : grade.tone === "correct" ? `+${grade.points}` : "0";
  return { tone: grade.tone, label: grade.tone === "empty" ? "—" : `${picked}${margin}`, detail };
}
