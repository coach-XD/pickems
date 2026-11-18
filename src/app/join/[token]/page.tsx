import { joinPool } from "@/app/actions/session";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { btnPrimary, cardClass, inputClass, labelClass } from "@/lib/ui";

export const metadata = { title: "Join" };

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const configured = Boolean(process.env.INVITE_TOKEN);

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Invite</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Join the pool</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        New here? Pick a name and a PIN. Back on another phone? Use the same name and PIN to reclaim your picks.
      </p>
      <form action={joinPool} className={`${cardClass} mt-6 space-y-4 p-4`}>
        <Flash error={query.error ?? (configured ? undefined : "invite-missing")} />
        <input type="hidden" name="token" value={token} />
        <label className="block">
          <span className={labelClass}>Display name</span>
          <input name="name" autoComplete="nickname" required maxLength={20} className={inputClass} placeholder="Sam" />
        </label>
        <label className="block">
          <span className={labelClass}>PIN</span>
          <input name="pin" inputMode="numeric" autoComplete="off" required pattern="\d{4,8}" className={inputClass} placeholder="4–8 digits" />
        </label>
        <SubmitButton className={`${btnPrimary} w-full`} pendingLabel="Joining…">
          Enter
        </SubmitButton>
      </form>
    </main>
  );
}
