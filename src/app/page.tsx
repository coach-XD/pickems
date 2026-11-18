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
  const requested = query.view ?? (player.isDemo ? "demo-stage" : "overall");
  const selected = requested === "overall" ? null : (stages.find((stage) => stage.slug === requested) ?? null);
  const stageIds = selected ? [selected.id] : realStages.map((stage) => stage.id);
  const board = await getLeaderboard(stageIds, Boolean(selected?.isDemo));
  const logoStageId = selected?.id ?? realStages[0]?.id;
  const field = logoStageId ? await listStageTeams(logoStageId) : [];
  const tabs = [
    { href: "/?view=overall", label: "Overall", active: !selected },
    ...stages.map((stage) => ({
      href: `/?view=${stage.slug}`,
      label: stage.name,
      active: selected?.id === stage.id,
    })),
  ];

  return (
    <AppShell name={player.displayName}>
      <div className="space-y-4">
        <Flash error={query.error} notice={query.notice} />
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Board</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {selected ? selected.name : "Every real stage, added together."}
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
        <div className="flex gap-2 overflow-x-auto pb-1">
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
          <div className="flex gap-2 overflow-x-auto pb-1">
            {field.map((team) => (
              <div key={team.teamId} className="shrink-0">
                <TeamBadge name={team.name} shortName={team.shortName} logoUrl={team.logoUrl} seed={team.seed} compact />
              </div>
            ))}
          </div>
        ) : null}
        {board.length === 0 ? (
          <p className={`${cardClass} p-4 text-sm text-zinc-400`}>Nobody has joined yet. Share the invite link.</p>
        ) : (
          <ol className="space-y-2">
            {board.map((row) => {
              const you = row.playerId === player.id;
              return (
                <li
                  key={row.playerId}
                  className={cx(
                    "flex items-center gap-3 rounded-2xl border px-3 py-3",
                    you ? "border-amber-400/50 bg-amber-400/10" : "border-white/10 bg-zinc-900/70",
                  )}
                >
                  <span className="w-12 shrink-0 font-mono text-sm text-amber-200">{formatRank(row.rank)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {row.name}
                      {you ? <span className="ml-2 text-xs font-medium text-amber-200">you</span> : null}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Match {row.matchPoints} · Maps {row.mapPoints} · Place {row.placementPoints}
                    </p>
                  </div>
                  <p className="text-xl font-semibold tabular-nums">{row.total}</p>
                </li>
              );
            })}
          </ol>
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
