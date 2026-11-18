import Link from "next/link";
import { Flash } from "@/components/Flash";
import { Countdown } from "@/components/Countdown";
import { MatchPicker } from "@/components/MatchPicker";
import { PlacementPicker } from "@/components/PlacementPicker";
import { Rules } from "@/components/Rules";
import { getSessionPlayer } from "@/lib/auth";
import { scoreMatchPick } from "@/lib/scoring";
import { picksForPlayer, stageBundle, listStages } from "@/lib/queries";
import { demoCookieOn } from "@/lib/auth";
import { earliest, isLocked, lockInstant } from "@/lib/time";
import { cardClass, cx } from "@/lib/ui";
import { redirect } from "next/navigation";

export const metadata = { title: "Picks" };

export default async function PicksPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; error?: string; notice?: string }>;
}) {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const query = await searchParams;
  const includeDemo = player.isDemo || (await demoCookieOn());
  const stages = await listStages(includeDemo);
  const stage = chooseStage(stages, query.stage, player.isDemo);
  if (!stage) {
    return <p className={`${cardClass} p-4 text-sm text-zinc-400`}>No stage is open yet.</p>;
  }

  const bundle = await stageBundle(stage.id);
  const mine = await picksForPlayer(
    player.id,
    stage.id,
    bundle.matches.map((match) => match.id),
  );
  const readOnly = player.isDemo && !stage.isDemo;
  const firstStart = earliest(
    bundle.matches.map((match) => match.scheduledAt),
    stage.startsAt,
  );
  const slateLocked = readOnly || isLocked(firstStart, new Date());
  const records = Object.fromEntries(bundle.standings.map((row) => [row.teamId, { wins: row.wins, losses: row.losses }]));
  const rounds = [...new Set(bundle.matches.map((match) => match.round))];

  return (
    <div className="space-y-4">
      <Flash error={query.error} notice={query.notice} />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My picks</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Stage slate <Countdown lockIso={lockInstant(firstStart).toISOString()} />
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {stages.map((item) => (
          <Link
            key={item.id}
            href={`/picks?stage=${item.slug}`}
            className={cx(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold",
              item.id === stage.id ? "border-amber-400/70 bg-amber-400 text-zinc-950" : "border-white/10 text-zinc-300",
            )}
          >
            {item.name}
          </Link>
        ))}
      </div>
      {readOnly ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300">
          Sample players can look at the real stage, but their picks stay on the sample stage.
        </p>
      ) : null}
      <PlacementPicker
        stageId={stage.id}
        slug={stage.slug}
        teams={bundle.teams.map((team) => ({
          teamId: team.teamId,
          name: team.name,
          shortName: team.shortName,
          logoUrl: team.logoUrl,
          seed: team.seed,
          worldRank: team.worldRank,
        }))}
        initial={mine.placements}
        locked={slateLocked}
        records={records}
      />
      <Rules />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Matches</h2>
          <Link href={`/stages/${stage.slug}/compare`} className="text-sm font-semibold text-amber-300">
            Compare
          </Link>
        </div>
        {bundle.matches.length === 0 ? <p className="text-sm text-zinc-500">No matches yet.</p> : null}
        {rounds.map((round) => (
          <div key={round} className="space-y-3">
            {bundle.matches
              .filter((match) => match.round === round)
              .map((match) => {
                const saved = mine.matches.find((pick) => pick.matchId === match.id) ?? null;
                const locked = readOnly || isLocked(match.scheduledAt, new Date());
                const scored = saved
                  ? scoreMatchPick({
                      format: match.format,
                      pickWinnerId: saved.winnerId,
                      pickScoreA: saved.scoreA,
                      pickScoreB: saved.scoreB,
                      resultWinnerId: match.winnerId,
                      resultScoreA: match.scoreA,
                      resultScoreB: match.scoreB,
                    })
                  : null;
                const pointsLabel =
                  match.winnerId && scored
                    ? scored.mapPoints
                      ? "2 pts"
                      : scored.winnerPoints
                        ? "1 pt"
                        : "0 pts"
                    : null;
                return (
                  <MatchPicker
                    key={match.id}
                    slug={stage.slug}
                    matchId={match.id}
                    round={match.round}
                    format={match.format}
                    scheduledAt={match.scheduledAt.toISOString()}
                    lockIso={lockInstant(match.scheduledAt).toISOString()}
                    locked={locked}
                    teamA={{
                      id: match.teamAId,
                      name: match.teamAName,
                      shortName: match.teamAShort,
                      logoUrl: match.teamALogo,
                      seed: bundle.teams.find((team) => team.teamId === match.teamAId)?.seed ?? 0,
                    }}
                    teamB={{
                      id: match.teamBId,
                      name: match.teamBName,
                      shortName: match.teamBShort,
                      logoUrl: match.teamBLogo,
                      seed: bundle.teams.find((team) => team.teamId === match.teamBId)?.seed ?? 0,
                    }}
                    saved={saved}
                    resultLabel={scoreLine(match)}
                    pointsLabel={pointsLabel}
                  />
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

function chooseStage<T extends { slug: string; isDemo: boolean; startsAt: Date }>(
  stages: T[],
  requested: string | undefined,
  preferDemo: boolean,
): T | null {
  if (requested) {
    const found = stages.find((stage) => stage.slug === requested);
    if (found) return found;
  }
  if (preferDemo) {
    const demo = stages.find((stage) => stage.isDemo);
    if (demo) return demo;
  }
  const now = Date.now();
  const upcoming = stages
    .filter((stage) => !stage.isDemo && stage.startsAt.getTime() >= now)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
  if (upcoming) return upcoming;
  const real = stages.filter((stage) => !stage.isDemo);
  return real[real.length - 1] ?? stages[0] ?? null;
}

function scoreLine(match: {
  winnerId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  teamAShort: string;
  teamBShort: string;
  teamAId: string;
}): string | null {
  if (!match.winnerId) return null;
  if (match.scoreA == null || match.scoreB == null) {
    return `Final · ${match.winnerId === match.teamAId ? match.teamAShort : match.teamBShort}`;
  }
  return `Final · ${match.teamAShort} ${match.scoreA}–${match.teamBShort} ${match.scoreB}`;
}
