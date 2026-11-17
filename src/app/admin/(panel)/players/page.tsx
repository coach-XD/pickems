import { removePlayer } from "@/app/actions/admin";
import { ConfirmForm } from "@/components/ConfirmForm";
import { Flash } from "@/components/Flash";
import { listPlayers } from "@/lib/queries";
import { btnDanger, cardClass } from "@/lib/ui";

export const metadata = { title: "Players" };

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const query = await searchParams;
  const roster = await listPlayers(true);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Players</h1>
      <Flash error={query.error} notice={query.notice} />
      <p className="text-sm text-zinc-400">Removing someone deletes their picks. They can rejoin with the invite link.</p>
      <ul className="space-y-2">
        {roster.map((player) => (
          <li key={player.id} className={`${cardClass} flex items-center justify-between gap-3 px-3 py-3`}>
            <div>
              <p className="font-semibold">
                {player.displayName}
                {player.isDemo ? <span className="ml-2 text-xs text-amber-200">Sample</span> : null}
              </p>
              <p className="text-xs text-zinc-500">Joined {player.createdAt.toISOString().slice(0, 10)}</p>
            </div>
            <ConfirmForm action={removePlayer} message={`Remove ${player.displayName}?`}>
              <input type="hidden" name="playerId" value={player.id} />
              <button type="submit" className={btnDanger}>
                Remove
              </button>
            </ConfirmForm>
          </li>
        ))}
      </ul>
      {roster.length === 0 ? <p className="text-sm text-zinc-500">No players yet.</p> : null}
    </div>
  );
}
