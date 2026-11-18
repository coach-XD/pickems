import Link from "next/link";
import { headers } from "next/headers";
import { deleteStage } from "@/app/actions/admin";
import { ConfirmForm } from "@/components/ConfirmForm";
import { Flash } from "@/components/Flash";
import { LocalTime } from "@/components/LocalTime";
import { adminStageSummaries } from "@/lib/queries";
import { btnDanger, btnPrimary, cardClass } from "@/lib/ui";

export const metadata = { title: "Admin" };

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const query = await searchParams;
  const summaries = await adminStageSummaries();
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const token = process.env.INVITE_TOKEN;
  const invite = token && host ? `${proto}://${host}/join/${encodeURIComponent(token)}` : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">Stages</h1>
        <Link href="/admin/stages/new" className={btnPrimary}>
          New stage
        </Link>
      </div>
      <Flash error={query.error} notice={query.notice} />
      <section className={`${cardClass} p-4`}>
        <h2 className="text-sm font-semibold">Invite link</h2>
        {invite ? (
          <input readOnly value={invite} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm" />
        ) : (
          <p className="mt-2 text-sm text-rose-200">Set INVITE_TOKEN, then redeploy.</p>
        )}
        <p className="mt-2 text-xs text-zinc-500">Friends open this, pick a name and a PIN, and the cookie brings them back.</p>
      </section>
      {summaries.length === 0 ? <p className="text-sm text-zinc-500">No stages yet. Seed Stage 1 or create one.</p> : null}
      <div className="space-y-3">
        {summaries.map((stage) => (
          <article key={stage.id} className={`${cardClass} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {stage.name}
                  {stage.isDemo ? <span className="ml-2 text-xs text-amber-200">Sample</span> : null}
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  <LocalTime iso={stage.startsAt.toISOString()} />
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {stage.teamCount} teams · {stage.playedCount}/{stage.matchCount} results
                </p>
              </div>
              <Link href={`/admin/stages/${stage.id}`} className="text-sm font-semibold text-amber-300">
                Edit
              </Link>
            </div>
            <ConfirmForm action={deleteStage} message={`Delete ${stage.name} and its matches?`} className="mt-3">
              <input type="hidden" name="stageId" value={stage.id} />
              <button type="submit" className={btnDanger}>
                Delete stage
              </button>
            </ConfirmForm>
          </article>
        ))}
      </div>
    </div>
  );
}
