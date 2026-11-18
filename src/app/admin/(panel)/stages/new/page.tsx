import { createStage } from "@/app/actions/admin";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { UtcDateTimeField } from "@/components/UtcDateTimeField";
import { btnPrimary, cardClass, inputClass, labelClass } from "@/lib/ui";

export const metadata = { title: "New stage" };

export default async function NewStagePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">New stage</h1>
      <p className="text-sm text-zinc-400">
        Use this for Stage 2 (28 Nov–1 Dec) and Stage 3 (about 2–5 Dec). Playoffs are out of scope.
      </p>
      <form action={createStage} className={`${cardClass} space-y-4 p-4`}>
        <Flash error={query.error} />
        <label className="block">
          <span className={labelClass}>Name</span>
          <input name="name" required className={inputClass} placeholder="Stage 2" />
        </label>
        <label className="block">
          <span className={labelClass}>Starts</span>
          <UtcDateTimeField name="startsAt" required />
        </label>
        <label className="block">
          <span className={labelClass}>Ends (optional)</span>
          <UtcDateTimeField name="endsAt" />
        </label>
        <label className="block">
          <span className={labelClass}>Sort order</span>
          <input name="sortOrder" inputMode="numeric" className={inputClass} placeholder="2" />
        </label>
        <SubmitButton className={btnPrimary}>Create stage</SubmitButton>
      </form>
    </div>
  );
}
