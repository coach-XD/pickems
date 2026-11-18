import Link from "next/link";
import { Flash } from "@/components/Flash";
import { Countdown } from "@/components/Countdown";
import { Rules } from "@/components/Rules";
import { PlayoffBracket } from "@/components/PlayoffBracket";
import { SwissSimulator } from "@/components/SwissSimulator";
import { getSessionPlayer } from "@/lib/auth";
import { listBrackets, stageBundle, listStages } from "@/lib/queries";
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
  if (!stage.picksOpen) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">{stage.name}</h1>
        <p className={`${cardClass} p-4 text-sm text-zinc-300`}>Coming soon. This stage is locked until the host opens it for picks.</p>
        <StageTabs stages={stages} currentId={stage.id} />
      </div>
    );
  }

  const bundle = await stageBundle(stage.id);
  const brackets = await listBrackets(stage.id);
  const mine = brackets.find((row) => row.playerId === player.id);
  const readOnly = player.isDemo && !stage.isDemo;
  const round1 = bundle.matches.filter((match) => match.round === 1);
  const firstStart = earliest(
    round1.map((match) => match.scheduledAt),
    stage.startsAt,
  );
  const slateLocked = readOnly || isLocked(firstStart, new Date());

  return (
    <div className="space-y-4">
      <Flash error={query.error} notice={query.notice} />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My picks</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Bracket <Countdown lockIso={lockInstant(firstStart).toISOString()} />
        </p>
      </div>
      <StageTabs stages={stages} currentId={stage.id} />
      {readOnly ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-300">
          Sample players can look at the real stage, but their picks stay on the sample stage.
        </p>
      ) : null}
      <div className="flex justify-end">
        <Link href={`/stages/${stage.slug}/compare`} className="text-sm font-semibold text-amber-300">
          Compare
        </Link>
      </div>
      {stage.kind === "playoff" ? (
        bundle.teams.length < 8 ? (
          <p className={`${cardClass} p-4 text-sm text-zinc-300`}>
            The eight playoff teams are not assigned yet. Quarterfinals are seeded 1 vs 8, 4 vs 5, 2 vs 7, and 3 vs 6 once they are.
          </p>
        ) : (
          <PlayoffBracket
            stageId={stage.id}
            locked={slateLocked}
            finalFormat={stage.finalFormat === "bo5" ? "bo5" : "bo3"}
            teams={bundle.teams.map((team) => ({
              teamId: team.teamId,
              name: team.name,
              shortName: team.shortName,
              logoUrl: team.logoUrl,
              seed: team.seed,
            }))}
            initialPicks={mine?.picks ?? []}
          />
        )
      ) : (
      <SwissSimulator
        stageId={stage.id}
        locked={slateLocked}
        teams={bundle.teams.map((team) => ({
          teamId: team.teamId,
          name: team.name,
          shortName: team.shortName,
          logoUrl: team.logoUrl,
          seed: team.seed,
        }))}
        round1={round1.map((match) => ({ teamAId: match.teamAId, teamBId: match.teamBId }))}
        initialPicks={mine?.picks ?? []}
        realMatches={bundle.matches.map((match) => ({
          round: match.round,
          teamAId: match.teamAId,
          teamBId: match.teamBId,
          format: match.format,
          winnerId: match.winnerId,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
        }))}
      />
      )}
      <Rules />
    </div>
  );
}

function StageTabs({
  stages,
  currentId,
}: {
  stages: Array<{ id: string; slug: string; name: string; picksOpen: boolean }>;
  currentId: string;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto">
      {stages.map((item) => (
        <Link
          key={item.id}
          href={`/picks?stage=${item.slug}`}
          className={cx(
            "shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold",
            item.id === currentId ? "border-amber-400/70 bg-amber-400 text-zinc-950" : "border-white/10 text-zinc-300",
          )}
        >
          {item.name}
          {item.picksOpen ? "" : " · locked"}
        </Link>
      ))}
    </div>
  );
}

function chooseStage<T extends { slug: string; isDemo: boolean; startsAt: Date; picksOpen: boolean }>(
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
  const open = stages.filter((stage) => !stage.isDemo && stage.picksOpen);
  const now = Date.now();
  const upcoming = open
    .filter((stage) => stage.startsAt.getTime() >= now)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
  if (upcoming) return upcoming;
  return open[open.length - 1] ?? stages.filter((stage) => !stage.isDemo).at(-1) ?? stages[0] ?? null;
}

