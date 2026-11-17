import { adminLogin } from "@/app/actions/session";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { btnPrimary, cardClass, inputClass, labelClass } from "@/lib/ui";

export const metadata = { title: "Admin" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-5 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Admin</p>
      <h1 className="mt-2 text-3xl font-semibold">Host sign-in</h1>
      <form action={adminLogin} className={`${cardClass} mt-6 space-y-4 p-4`}>
        <Flash error={query.error} />
        <label className="block">
          <span className={labelClass}>Password</span>
          <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </label>
        <SubmitButton className={`${btnPrimary} w-full`} pendingLabel="Checking…">
          Sign in
        </SubmitButton>
      </form>
    </main>
  );
}
