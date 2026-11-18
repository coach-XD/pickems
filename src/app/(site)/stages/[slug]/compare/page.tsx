import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { demoCookieOn, getSessionPlayer } from "@/lib/auth";
import { allPicksForStage, getLeaderboard, getStageBySlug, stageBundle } from "@/lib/queries";
import { scoreMatchPick } from "@/lib/scoring";
import { earliest, isLocked } from "@/lib/time";
import { SLOT_LABEL, type Slot } from "@/lib/types";
import { cx } from "@/lib/ui";

export const metadata = { title: "Compare" };

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const { slug } = await params;
  const includeDemo = player.isDemo || (await demoCookieOn());
  const stage = await getStageBySlug(slug);
  if (!stage || (stage.isDemo && !includeDemo)) notFound();

  const bundle = await stageBundle(stage.id);
  const board = await getLeaderboard([stage.id], stage.isDemo);
  const picks = await allPicksForStage(
    stage.id,
    bundle.matches.map((match) => match.id),
  );
  const now = new Date();
  const slateLocked = isLocked(
    earliest(
      bundle.matches.map((match) => match.scheduledAt),
      stage.startsAt,
    ),
    now,
  );
  const teamName = new Map(bundle.teams.map((team) => [team.teamId, team.shortName]));
  const placementByPlayer = new Map<string, Map<string, Slot>>();
  for (const pick of picks.slots) {
    const map = placementByPlayer.get(pick.playerId) ?? new Map<string, Slot>();
    map.set(pick.teamId, pick.slot);
    placementByPlayer.set(pick.playerId, map);
  }
  const matchByPlayer = new Map<string, Map<string, (typeof picks.series)[number]>>();
  for (const pick of picks.series) {
    const map = matchByPlayer.get(pick.playerId) ?? new Map();
    map.set(pick.matchId, pick);
    matchByPlayer.set(pick.playerId, map);
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/stages/${stage.slug}`} className="text-xs font-semibold text-zinc-500">
          {stage.name}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Picks</h1>
        <p className="mt-1 text-sm text-zinc-400">Other picks stay hidden until that slate or series locks.</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">Stage picks</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr>
                <th className="freeze-col border-b border-white/10 px-3 py-2 font-medium text-zinc-400">Team</th>
                {board.map((entry) => (
                  <th key={entry.playerId} className="border-b border-white/10 px-3 py-2 font-medium text-zinc-300">
                    {entry.name}
                    {entry.playerId === player.id ? <span className="block text-[10px] text-amber-200">you</span> : null}
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
                    const slot = placementByPlayer.get(entry.playerId)?.get(team.teamId);
                    const hidden = entry.playerId !== player.id && !slateLocked;
                    return (
                      <td key={entry.playerId} className="border-b border-white/5 px-3 py-2 text-zinc-300">
                        {hidden ? "Hidden" : slot ? SLOT_LABEL[slot] : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">Matches</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr>
                <th className="freeze-col border-b border-white/10 px-3 py-2 font-medium text-zinc-400">Series</th>
                {board.map((entry) => (
                  <th key={entry.playerId} className="border-b border-white/10 px-3 py-2 font-medium text-zinc-300">
                    {entry.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bundle.matches.map((match) => {
                const locked = isLocked(match.scheduledAt, now);
                return (
                  <tr key={match.id}>
                    <th className="freeze-col border-b border-white/5 px-3 py-2 text-left font-medium text-zinc-200">
                      R{match.round} {match.teamAShort} vs {match.teamBShort}
                      <span className="block font-normal text-zinc-500">{match.format === "bo3" ? "Bo3" : "Bo1"}</span>
                    </th>
                    {board.map((entry) => {
                      const pick = matchByPlayer.get(entry.playerId)?.get(match.id);
                      const hidden = entry.playerId !== player.id && !locked;
                      if (hidden) {
                        return (
                          <td key={entry.playerId} className="border-b border-white/5 px-3 py-2 text-zinc-500">
                            Hidden
                          </td>
                        );
                      }
                      if (!pick) {
                        return (
                          <td key={entry.playerId} className="border-b border-white/5 px-3 py-2 text-zinc-600">
                            —
                          </td>
                        );
                      }
                      const scored = scoreMatchPick({
                        format: match.format,
                        pickWinnerId: pick.winnerId,
                        pickScoreA: pick.scoreA,
                        pickScoreB: pick.scoreB,
                        resultWinnerId: match.winnerId,
                        resultScoreA: match.scoreA,
                        resultScoreB: match.scoreB,
                      });
                      const margin =
                        match.format === "bo3" && pick.scoreA != null && pick.scoreB != null
                          ? ` ${Math.max(pick.scoreA, pick.scoreB)}-${Math.min(pick.scoreA, pick.scoreB)}`
                          : "";
                      const tone = !match.winnerId
                        ? "text-zinc-200"
                        : scored.mapPoints
                          ? "bg-emerald-400/15 text-emerald-100"
                          : scored.winnerPoints
                            ? "text-emerald-200"
                            : "text-rose-200";
                      return (
                        <td key={entry.playerId} className={cx("border-b border-white/5 px-3 py-2", tone)}>
                          {teamName.get(pick.winnerId) ?? "Pick"}
                          {margin}
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
    </div>
  );
}
