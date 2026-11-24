import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PlayoffBracket } from "@/components/PlayoffBracket";
import { SwissSimulator } from "@/components/SwissSimulator";
import { derivedPlacements, projectBracket, scoreBracket } from "@/lib/bracket";
import { demoCookieOn, getSessionPlayer, isAdmin } from "@/lib/auth";
import { allowDemoData } from "@/lib/logos";
import { bracketStatus, canViewPicks } from "@/lib/pickVisibility";
import { scorePlayoff } from "@/lib/playoff";
import { gradePlacementPick } from "@/lib/results";
import { SLOT_LABEL } from "@/lib/types";
import { maybeRefreshOdds } from "@/lib/odds/refresh";
import { listBrackets, listPlayers, listStageOdds, listStages, stageBundle } from "@/lib/queries";
import { deriveStandings } from "@/lib/swiss";
import { earliest, isLocked } from "@/lib/time";
import { cardClass, cx } from "@/lib/ui";

export const metadata = { title: "Player picks" };

export default async function PlayerPicksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const viewer = await getSessionPlayer();
  if (!viewer) redirect("/");
  const { id } = await params;
  const query = await searchParams;
  const includeDemo = allowDemoData() && (viewer.isDemo || (await demoCookieOn()));
  const [people, stages, admin] = await Promise.all([listPlayers(includeDemo), listStages(includeDemo), isAdmin()]);
  const person = people.find((row) => row.id === id);
  if (!person) notFound();
  const stage =
    stages.find((item) => item.slug === query.stage) ??
    stages.find((item) => !item.isDemo && item.picksOpen) ??
    stages.find((item) => !item.isDemo) ??
    stages[0];
  if (!stage) {
    return <p className={`${cardClass} p-4 text-sm text-zinc-400`}>No stage is open yet.</p>;
  }

  const bundle = await stageBundle(stage.id);
  void maybeRefreshOdds();
  const odds = await listStageOdds(stage.id);
  const brackets = await listBrackets(stage.id);
  const stored = brackets.find((row) => row.playerId === person.id);
  const picks = stored?.picks ?? [];
  const round1 = bundle.matches.filter((match) => match.round === 1);
  const teams = bundle.teams.map((team) => ({ teamId: team.teamId, seed: team.seed }));
  const firstStart = earliest(round1.map((match) => match.scheduledAt), stage.startsAt);
  const slateLocked = isLocked(firstStart, new Date());
  const visible = canViewPicks({
    isOwner: viewer.id === person.id,
    isAdmin: admin,
    slateLocked,
    showBeforeLock: stage.showPicksBeforeLock,
  });
  const projected = projectBracket({ teams, round1: round1.map((match) => ({ teamAId: match.teamAId, teamBId: match.teamBId })), picks });
  const status = bracketStatus(projected.filter((match) => match.winnerId).length, projected.length);
  const statusLabel = status === "complete" ? "Bracket complete" : status === "partial" ? "Bracket in progress" : "No picks yet";
  const hiddenSentence =
    status === "complete"
      ? `Picks hidden until the bracket locks. ${person.displayName} has completed their bracket.`
      : status === "partial"
        ? `Picks hidden until the bracket locks. ${person.displayName} hasn't finished their bracket yet.`
        : `Picks hidden until the bracket locks. ${person.displayName} hasn't started their bracket yet.`;
  const standings = deriveStandings(
    teams,
    bundle.matches.map((match) => ({
      round: match.round,
      scheduledAt: match.scheduledAt,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      winnerId: match.winnerId,
    })),
  );
  const score =
    stage.kind === "playoff"
      ? scorePlayoff({
          teams,
          picks,
          finalFormat: stage.finalFormat === "bo5" ? "bo5" : "bo3",
          realMatches: bundle.matches.map((match) => ({
            teamAId: match.teamAId,
            teamBId: match.teamBId,
            winnerId: match.winnerId,
          })),
        })
      : scoreBracket({
          teams,
          round1: round1.map((match) => ({ teamAId: match.teamAId, teamBId: match.teamBId })),
          picks,
          realMatches: bundle.matches.map((match) => ({
            round: match.round,
            teamAId: match.teamAId,
            teamBId: match.teamBId,
            format: match.format,
            winnerId: match.winnerId,
            scoreA: match.scoreA,
            scoreB: match.scoreB,
          })),
          realRecords: new Map(standings.map((row) => [row.teamId, { wins: row.wins, losses: row.losses }])),
        });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/players" className="text-xs font-semibold text-zinc-500">
            All players
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{person.displayName}</h1>
          <p className="text-sm text-zinc-400">
            {visible ? statusLabel : "Picks hidden until the bracket locks"}
          </p>
        </div>
        {visible ? (
          <div className="text-right text-sm tabular-nums text-zinc-300">
            <p>
              Match {score.matchPoints} · Maps {score.mapPoints} · Place {score.placementPoints} ·{" "}
              <span className="font-semibold text-white">Total {score.matchPoints + score.mapPoints + score.placementPoints}</span>
            </p>
            {stage.kind === "swiss" ? (
              <p className="mt-1 text-xs text-zinc-500">
                {derivedPlacements(teams, projected).length === 0
                  ? "3-0, 0-3, and advance are pending"
                  : derivedPlacements(teams, projected)
                      .map((slot) => {
                        const record = standings.find((row) => row.teamId === slot.teamId);
                        const grade = gradePlacementPick(slot.slot, record?.wins ?? 0, record?.losses ?? 0);
                        const name = bundle.teams.find((team) => team.teamId === slot.teamId)?.shortName ?? "Team";
                        return `${name} ${SLOT_LABEL[slot.slot]} ${grade.tone === "pending" ? "pending" : grade.tone === "correct" ? `+${grade.points}` : "wrong"}`;
                      })
                      .join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {stages.map((item) => (
          <Link
            key={item.id}
            href={`/players/${person.id}?stage=${item.slug}`}
            className={cx(
              "shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold",
              item.id === stage.id ? "border-amber-400/70 bg-amber-400 text-zinc-950" : "border-white/10 text-zinc-300",
            )}
          >
            {item.name}
            {item.picksOpen ? "" : " · locked"}
          </Link>
        ))}
      </div>
      {!visible ? (
        <p className={`${cardClass} p-4 text-sm text-zinc-300`}>
          {hiddenSentence}
        </p>
      ) : stage.kind === "playoff" ? (
        <PlayoffBracket
          stageId={stage.id}
          locked
          readOnly
          finalFormat={stage.finalFormat === "bo5" ? "bo5" : "bo3"}
          teams={bundle.teams.map((team) => ({
            teamId: team.teamId,
            name: team.name,
            shortName: team.shortName,
            logoUrl: team.logoUrl,
            seed: team.seed,
          }))}
          initialPicks={picks}
        />
      ) : (
        <SwissSimulator
          stageId={stage.id}
          locked={slateLocked}
          readOnly
          teams={bundle.teams.map((team) => ({
            teamId: team.teamId,
            name: team.name,
            shortName: team.shortName,
            logoUrl: team.logoUrl,
            seed: team.seed,
            worldRank: team.worldRank,
            vrsPoints: team.vrsPoints,
          }))}
          realOdds={odds}
          round1={round1.map((match) => ({ teamAId: match.teamAId, teamBId: match.teamBId }))}
          initialPicks={picks}
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
    </div>
  );
}
