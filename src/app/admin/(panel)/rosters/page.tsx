import { saveRoster } from "@/app/actions/admin";
import { Flash } from "@/components/Flash";
import { TeamBadge } from "@/components/TeamBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { formatRating, ratingClass, ratingTone } from "@/lib/rating";
import { listRosterForAdmin } from "@/lib/queries";
import { btnPrimary, cardClass, inputClass, labelClass } from "@/lib/ui";
import { cx } from "@/lib/ui";

export const metadata = { title: "Rosters" };

export default async function RostersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const query = await searchParams;
  const teams = await listRosterForAdmin();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-semibold">Rosters</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Nicknames and HLTV Rating 3.0 for each team. Leave a rating blank to clear it. A blank rating can be filled again the next time the roster seed runs.
        </p>
      </div>
      <Flash error={query.error} notice={query.notice} />
      {teams.length === 0 ? <p className="text-sm text-zinc-500">No roster rows yet. Run the seed after Stage 1 exists.</p> : null}
      {teams.map((team) => (
        <form key={team.teamId} id={`team-${team.teamId}`} action={saveRoster} className={`${cardClass} space-y-3 p-4`}>
          <input type="hidden" name="teamId" value={team.teamId} />
          <TeamBadge name={team.name} shortName={team.shortName} logoUrl={team.logoUrl} seed={team.seed ?? undefined} compact />
          <div className="grid grid-cols-[1fr_5.5rem] gap-2">
            <span className={labelClass}>Nickname</span>
            <span className={labelClass}>Rating</span>
            {team.players.map((player) => (
              <div key={player.id} className="col-span-2 grid grid-cols-[1fr_5.5rem] gap-2">
                <input type="hidden" name="playerId" value={player.id} />
                <input name={`nickname_${player.id}`} defaultValue={player.nickname} required className={inputClass} />
                <input
                  name={`rating_${player.id}`}
                  defaultValue={player.rating == null ? "" : formatRating(player.rating)}
                  inputMode="decimal"
                  placeholder="–"
                  className={cx(inputClass, "text-right", ratingClass(ratingTone(player.rating)))}
                />
              </div>
            ))}
          </div>
          <SubmitButton className={btnPrimary}>Save {team.shortName}</SubmitButton>
        </form>
      ))}
    </div>
  );
}
