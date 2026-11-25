import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Countdown } from "@/components/Countdown";
import { LocalTime } from "@/components/LocalTime";
import { TeamBadge } from "@/components/TeamBadge";
import { demoCookieOn, getSessionPlayer } from "@/lib/auth";
import { allowDemoData } from "@/lib/logos";
import { stageUsesLiveOdds } from "@/lib/odds/price";
import { maybeRefreshOdds } from "@/lib/odds/refresh";
import { getStageBySlug, stageBundle } from "@/lib/queries";
import { earliest, lockInstant } from "@/lib/time";
import { cardClass, cx } from "@/lib/ui";

export const metadata = { title: "Stage" };

export default async function StagePage({ params }: { params: Promise<{ slug: string }> }) {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const { slug } = await params;
  const includeDemo = allowDemoData() && (player.isDemo || (await demoCookieOn()));
  const stage = await getStageBySlug(slug);
  if (!stage || (stage.isDemo && !includeDemo)) notFound();
  const bundle = await stageBundle(stage.id);
  if (stageUsesLiveOdds(stage.slug)) void maybeRefreshOdds();
  const advanced = bundle.standings.filter((row) => row.status === "advanced").length;
  const eliminated = bundle.standings.filter((row) => row.status === "eliminated").length;
  const firstStart = earliest(
    bundle.matches.map((match) => match.scheduledAt),
    stage.startsAt,
  );
  const rounds = [...new Set(bundle.matches.map((match) => match.round))];
  const sections = [
    { title: "Advanced", pools: bundle.pools.advanced, tone: "text-emerald-300" },
    { title: "In progress", pools: bundle.pools.active, tone: "text-amber-200" },
    { title: "Eliminated", pools: bundle.pools.eliminated, tone: "text-rose-300" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Swiss</p>
          <h1 className="text-3xl font-semibold tracking-tight">{stage.name}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Picks <Countdown lockIso={lockInstant(firstStart).toISOString()} />
          </p>
        </div>
        <p className="text-right text-xs text-zinc-400">
          {advanced}/8 advanced
          <br />
          {eliminated}/8 out
        </p>
      </div>
      <div className="flex gap-2">
        <Link href={`/picks?stage=${stage.slug}`} className="rounded-xl bg-amber-400 px-3 py-2 text-sm font-semibold text-zinc-950">
          My picks
        </Link>
        <Link href={`/stages/${stage.slug}/compare`} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold">
          Compare
        </Link>
      </div>
      <p className="text-sm text-zinc-500">16 teams. 3 wins advance, 3 losses are out. Bo3 is used for advancement and elimination series.</p>
      {sections.map((section) =>
        section.pools.length === 0 ? null : (
          <section key={section.title} className="space-y-3">
            <h2 className={`text-sm font-semibold uppercase tracking-[0.14em] ${section.tone}`}>{section.title}</h2>
            {section.pools.map((pool) => (
              <div key={`${section.title}-${pool.record}`} className={`${cardClass} p-3`}>
                <p className="text-xs font-semibold text-zinc-400">
                  {pool.record}
                  <span className="ml-2 text-zinc-600">{pool.teams.length}</span>
                </p>
                <ul className="mt-2 space-y-2">
                  {pool.teams.map((row) => (
                    <li key={row.teamId} className="flex items-center justify-between gap-3">
                      <TeamBadge
                        name={row.team.name}
                        shortName={row.team.shortName}
                        logoUrl={row.team.logoUrl}
                        seed={row.team.seed}
                        worldRank={row.team.worldRank}
                        compact
                      />
                      <span className="shrink-0 text-right text-[11px] text-zinc-500">
                        {row.team.otherRank != null ? <span className="block text-amber-200/80">#{row.team.otherRank}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ),
      )}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">Matches</h2>
        {rounds.length === 0 ? <p className="text-sm text-zinc-500">Round 1 has not been added yet.</p> : null}
        {rounds.map((round) => (
          <div key={round} className="space-y-2">
            <p className="text-xs font-semibold text-zinc-500">Round {round}</p>
            {bundle.matches
              .filter((match) => match.round === round)
              .map((match) => {
                const aWon = match.winnerId === match.teamAId;
                const bWon = match.winnerId === match.teamBId;
                return (
                  <article key={match.id} className={`${cardClass} p-3`}>
                    <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-500">
                      <span>{match.format === "bo3" ? "Bo3" : "Bo1"}</span>
                      <LocalTime iso={match.scheduledAt.toISOString()} />
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <span className={cx("min-w-0", aWon && "text-emerald-200", bWon && "opacity-60")}>
                        <TeamBadge name={match.teamAName} shortName={match.teamAShort} logoUrl={match.teamALogo} compact />
                      </span>
                      <span className="text-center font-mono text-sm text-zinc-300">
                        {match.scoreA != null && match.scoreB != null ? `${match.scoreA}–${match.scoreB}` : "vs"}
                      </span>
                      <span className={cx("min-w-0 justify-self-end text-right", bWon && "text-emerald-200", aWon && "opacity-60")}>
                        <TeamBadge name={match.teamBName} shortName={match.teamBShort} logoUrl={match.teamBLogo} compact align="end" />
                      </span>
                    </div>
                  </article>
                );
              })}
          </div>
        ))}
      </section>
    </div>
  );
}
