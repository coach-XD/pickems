import Link from "next/link";
import { demoCookieOn, getSessionPlayer } from "@/lib/auth";
import { listStages, stageBundle } from "@/lib/queries";
import { cardClass } from "@/lib/ui";
import { LocalTime } from "@/components/LocalTime";
import { redirect } from "next/navigation";

export const metadata = { title: "Stages" };

export default async function StagesPage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const includeDemo = player.isDemo || (await demoCookieOn());
  const stages = await listStages(includeDemo);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Stages</h1>
        <p className="mt-1 text-sm text-zinc-400">Swiss stages, then an eight-team playoff. Locked stages stay closed until the host opens them.</p>
      </div>
      {stages.length === 0 ? <p className={`${cardClass} p-4 text-sm text-zinc-400`}>No stages yet.</p> : null}
      <div className="space-y-3">
        {await Promise.all(
          stages.map(async (stage) => {
            const bundle = await stageBundle(stage.id);
            const advanced = bundle.standings.filter((row) => row.status === "advanced").length;
            const eliminated = bundle.standings.filter((row) => row.status === "eliminated").length;
            return (
              <article key={stage.id} className={`${cardClass} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {stage.name}
                      {stage.isDemo ? <span className="ml-2 text-xs font-medium text-amber-200">Sample</span> : null}
                      {!stage.picksOpen ? <span className="ml-2 text-xs font-medium text-zinc-400">Coming soon · locked</span> : null}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      <LocalTime iso={stage.startsAt.toISOString()} />
                      {stage.endsAt ? (
                        <>
                          {" "}
                          – <LocalTime iso={stage.endsAt.toISOString()} />
                        </>
                      ) : null}
                    </p>
                  </div>
                  <p className="text-right text-xs text-zinc-400">
                    {stage.kind === "playoff" ? (
                      "Playoffs"
                    ) : (
                      <>
                        {advanced}/8 advanced
                        <br />
                        {eliminated} out
                      </>
                    )}
                  </p>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/stages/${stage.slug}`} className="rounded-xl bg-amber-400 px-3 py-2 text-sm font-semibold text-zinc-950">
                    {stage.kind === "playoff" ? "Bracket" : "Swiss"}
                  </Link>
                  {stage.picksOpen ? (
                    <Link href={`/picks?stage=${stage.slug}`} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold">
                      Picks
                    </Link>
                  ) : (
                    <span className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-500">Picks locked</span>
                  )}
                </div>
              </article>
            );
          }),
        )}
      </div>
    </div>
  );
}
