import Link from "next/link";
import { setSampleVisibility } from "@/app/actions/session";
import { AppShell } from "@/components/AppShell";
import { Flash } from "@/components/Flash";
import { demoCookieOn, getSessionPlayer } from "@/lib/auth";
import { allowDemoData } from "@/lib/logos";
import { formatRank } from "@/lib/ranking";
import { TeamBadge } from "@/components/TeamBadge";
import { getLeaderboard, hasDemoStage, listStageTeams, listStages } from "@/lib/queries";
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
  const logoStageId = selected?.id ?? realStages[0]?.id;
  const field = logoStageId ? await listStageTeams(logoStageId) : [];
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
              <TeamBadge key={team.teamId} name={team.name} shortName={team.shortName} logoUrl={team.logoUrl} seed={team.seed} compact />
            ))}
          </div>
        ) : null}
        {board.length === 0 ? (
          <p className={`${cardClass} p-4 text-sm text-zinc-400`}>Nobody has joined yet. Share the invite link.</p>
        ) : (
          <div className={`${cardClass} overflow-hidden`}>
            <div className="grid grid-cols-[2.4rem_minmax(0,1fr)_3.2rem_3.2rem_3.2rem_3.4rem] gap-2 border-b border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:grid-cols-[3rem_minmax(0,1fr)_4.5rem_4.5rem_4.5rem_4.5rem] sm:text-xs">
              <span>Rank</span>
              <span>Name</span>
              <span className="text-right">Match</span>
              <span className="text-right">Maps</span>
              <span className="text-right">Place</span>
              <span className="text-right">Total</span>
            </div>
            <ol>
              {board.map((row) => {
                const you = row.playerId === player.id;
                return (
                  <li
                    key={row.playerId}
                    className={cx(
                      "grid grid-cols-[2.4rem_minmax(0,1fr)_3.2rem_3.2rem_3.2rem_3.4rem] items-center gap-2 border-b border-white/5 px-3 py-2.5 last:border-b-0 sm:grid-cols-[3rem_minmax(0,1fr)_4.5rem_4.5rem_4.5rem_4.5rem]",
                      you && "bg-amber-400/10",
                    )}
                  >
                    <span className="font-mono text-sm text-amber-200">{formatRank(row.rank)}</span>
                    <span className="truncate font-semibold">
                      {row.name}
                      {you ? <span className="ml-2 text-xs font-medium text-amber-200">you</span> : null}
                    </span>
                    <span className="text-right text-sm tabular-nums text-zinc-300">{row.matchPoints}</span>
                    <span className="text-right text-sm tabular-nums text-zinc-300">{row.mapPoints}</span>
                    <span className="text-right text-sm tabular-nums text-zinc-300">{row.placementPoints}</span>
                    <span className="text-right text-base font-semibold tabular-nums">{row.total}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        <p className="text-xs leading-5 text-zinc-500">
          Tied totals share a rank, and the next rank skips.
          {selected?.isDemo ? " This is the sample stage, kept off the overall total." : ""}
        </p>
      </div>
    </AppShell>
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
