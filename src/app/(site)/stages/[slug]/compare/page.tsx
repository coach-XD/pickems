import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { derivedPlacements, projectBracket } from "@/lib/bracket";
import { demoCookieOn, getSessionPlayer } from "@/lib/auth";
import { allowDemoData } from "@/lib/logos";
import { getLeaderboard, getStageBySlug, listBrackets, stageBundle } from "@/lib/queries";
import { pairKey } from "@/lib/swiss";
import { earliest, isLocked } from "@/lib/time";
import { SLOT_LABEL, type Slot } from "@/lib/types";
import { cx } from "@/lib/ui";

export const metadata = { title: "Compare" };

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const { slug } = await params;
  const includeDemo = allowDemoData() && (player.isDemo || (await demoCookieOn()));
  const stage = await getStageBySlug(slug);
  if (!stage || (stage.isDemo && !includeDemo)) notFound();

  const bundle = await stageBundle(stage.id);
  const board = await getLeaderboard([stage.id], stage.isDemo);
  const brackets = await listBrackets(stage.id);
  const round1 = bundle.matches.filter((match) => match.round === 1).map((match) => ({ teamAId: match.teamAId, teamBId: match.teamBId }));
  const teams = bundle.teams.map((team) => ({ teamId: team.teamId, seed: team.seed }));
  const now = new Date();
  const slateLocked = isLocked(earliest(bundle.matches.filter((match) => match.round === 1).map((match) => match.scheduledAt), stage.startsAt), now);
  const teamName = new Map(bundle.teams.map((team) => [team.teamId, team.shortName]));

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
    <div className="space-y-4">
      <div>
        <Link href={`/picks?stage=${stage.slug}`} className="text-xs font-semibold text-zinc-500">
          Back to your bracket
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{stage.name}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {slateLocked ? "Brackets are locked, so every pick is visible." : "Other brackets stay hidden until the lock."}
        </p>
      </div>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">Derived slate</h2>
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
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">Real matches</h2>
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
              {bundle.matches.map((match) => (
                <tr key={match.id}>
                  <th className="freeze-col border-b border-white/5 px-3 py-2 text-left font-medium text-zinc-200">
                    R{match.round} {match.teamAShort} vs {match.teamBShort}
                  </th>
                  {board.map((entry) => {
                    const hidden = entry.playerId !== player.id && !slateLocked;
                    const pick = projected.get(entry.playerId)?.byPair.get(pairKey(match.teamAId, match.teamBId));
                    if (hidden) return <td key={entry.playerId} className="border-b border-white/5 px-3 py-2 text-zinc-500">Hidden</td>;
                    if (!pick?.winnerId) return <td key={entry.playerId} className="border-b border-white/5 px-3 py-2 text-zinc-600">—</td>;
                    const correct = match.winnerId && pick.winnerId === match.winnerId;
                    const wrong = match.winnerId && pick.winnerId !== match.winnerId;
                    return (
                      <td key={entry.playerId} className={cx("border-b border-white/5 px-3 py-2", correct && "text-emerald-200", wrong && "text-rose-200")}>
                        {teamName.get(pick.winnerId)}
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
