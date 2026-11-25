import Link from "next/link";
import { setSampleVisibility } from "@/app/actions/session";
import { AppShell } from "@/components/AppShell";
import { Flash } from "@/components/Flash";
import { demoCookieOn, getSessionPlayer } from "@/lib/auth";
import { allowDemoData } from "@/lib/logos";
import { TeamBadge } from "@/components/TeamBadge";
import { maybeRefreshOdds } from "@/lib/odds/refresh";
import { oddsForStage, stageUsesLiveOdds } from "@/lib/odds/price";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { getLeaderboard, hasDemoStage, listStageOdds, listStageMatches, listStageTeams, listStages, pointsSinceLastResult } from "@/lib/queries";
import { btnGhost, cardClass, cx } from "@/lib/ui";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; error?: string; notice?: string }>;
}) {
  const player = await getSessionPlayer();
  const query = await searchParams;
  if (!player) return <Landing />;

  const includeDemo = allowDemoData() && (player.isDemo || (await demoCookieOn()));
  const [stages, demoExists] = await Promise.all([listStages(includeDemo), hasDemoStage()]);
  const realStages = stages.filter((stage) => !stage.isDemo);
  const openStage = realStages.find((stage) => stage.picksOpen);
  const requested = query.view ?? (player.isDemo ? "demo-stage" : openStage?.slug ?? "overall");
  const selected = requested === "overall" ? null : (stages.find((stage) => stage.slug === requested) ?? null);
  const stageIds = selected ? [selected.id] : realStages.map((stage) => stage.id);
  const board = await getLeaderboard(stageIds, Boolean(selected?.isDemo));
  const gains = await pointsSinceLastResult(stageIds);
  const oddsStage = selected ?? realStages[0] ?? null;
  const logoStageId = oddsStage?.id;
  if (!oddsStage || stageUsesLiveOdds(oddsStage.slug)) void maybeRefreshOdds();
  const field = logoStageId ? await listStageTeams(logoStageId) : [];
  const round1 = logoStageId ? (await listStageMatches(logoStageId)).filter((match) => match.round === 1) : [];
  const odds = logoStageId ? await listStageOdds(logoStageId) : [];
  const teamById = new Map(field.map((team) => [team.teamId, team]));
  const tabs = [
    { href: "/?view=overall", label: "Overall", active: !selected },
    ...stages.map((stage) => ({
      href: `/?view=${stage.slug}`,
      label: stage.picksOpen ? stage.name : `${stage.name} · locked`,
      active: selected?.id === stage.id,
    })),
  ];

  return (
    <AppShell name={player.displayName}>
      <div className="space-y-4">
        <Flash error={query.error} notice={query.notice} />
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Board</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {selected ? selected.name : "Every real stage, added together."}
              {selected && !selected.picksOpen ? " · picks locked" : ""}
            </p>
          </div>
          {!player.isDemo && demoExists ? (
            <form action={setSampleVisibility}>
              <input type="hidden" name="on" value={includeDemo ? "0" : "1"} />
              <button type="submit" className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-200 hover:underline">
                {includeDemo ? "Hide sample" : "Show sample"}
              </button>
            </form>
          ) : null}
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cx(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold",
                tab.active ? "border-amber-400/70 bg-amber-400 text-zinc-950" : "border-white/10 text-zinc-300",
              )}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        {field.length > 0 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-2">
            {field.map((team) => (
                <TeamBadge key={team.teamId} name={team.name} shortName={team.shortName} logoUrl={team.logoUrl} seed={team.seed} worldRank={team.worldRank} compact />
            ))}
          </div>
        ) : null}
        {round1.length > 0 ? (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-2">
              {round1.map((match) => {
                const stored = odds.find((row) => row.matchId === match.id);
                const teamA = teamById.get(match.teamAId);
                const teamB = teamById.get(match.teamBId);
                const line = oddsForStage(oddsStage?.slug ?? "stage-1", {
                  pointsA: teamA?.vrsPoints,
                  pointsB: teamB?.vrsPoints,
                  realA: stored?.oddsA,
                  realB: stored?.oddsB,
                });
                return (
                  <span key={match.id} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[11px]">
                    <span className="font-semibold text-zinc-200">{match.teamAShort}</span>
                    {line ? <OddsBit odds={line.oddsA} percent={line.percentA} favorite={line.oddsA <= line.oddsB} /> : null}
                    <span className="text-zinc-600">vs</span>
                    <span className="font-semibold text-zinc-200">{match.teamBShort}</span>
                    {line ? <OddsBit odds={line.oddsB} percent={line.percentB} favorite={line.oddsB < line.oddsA} /> : <span className="text-zinc-600">odds TBA</span>}
                    {line?.projected ? <span className="text-[9px] font-semibold uppercase text-zinc-500">Proj</span> : null}
                  </span>
                );
              })}
            </div>
            <p className="text-[10px] text-zinc-500">Odds for fun · don&apos;t affect scoring</p>
          </div>
        ) : null}
        <LeaderboardTable
          rows={board}
          youId={player.id}
          stageSlug={selected?.slug ?? openStage?.slug ?? "stage-1"}
          gains={gains}
        />
        <p className="text-xs leading-5 text-zinc-500">
          Tied totals share a rank, and the next rank skips.
          {selected?.isDemo ? " This is the sample stage, kept off the overall total." : ""}
        </p>
      </div>
    </AppShell>
  );
}

function OddsBit({ odds, percent, favorite }: { odds: number; percent: number; favorite: boolean }) {
  return (
    <span className={favorite ? "rounded-full bg-amber-400/20 px-1.5 font-semibold text-amber-100" : "rounded-full bg-white/5 px-1.5 text-zinc-400"}>
      {odds.toFixed(2)} · {percent}%
    </span>
  );
}

function Landing() {
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">PGL Singapore 2026</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">Major Pick&apos;em</h1>
      <p className="mt-3 text-base leading-7 text-zinc-400">
        A private Swiss-stage pool. Call the 3-0s, the 0-3s, and the winner of every series.
      </p>
      <ol className="mt-8 space-y-3 text-sm text-zinc-300">
        <li className={`${cardClass} px-4 py-3`}>Open the invite link from the host.</li>
        <li className={`${cardClass} px-4 py-3`}>Choose a display name and a short PIN.</li>
        <li className={`${cardClass} px-4 py-3`}>The same name and PIN get you back in on another phone.</li>
      </ol>
      <p className="mt-8 text-sm text-zinc-500">No invite link yet? Ask Sam. This board is not public.</p>
      <Link href="/admin" className={`${btnGhost} mt-6 w-fit`}>
        Admin
      </Link>
    </main>
  );
}
