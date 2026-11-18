import Link from "next/link";
import { redirect } from "next/navigation";
import { demoCookieOn, getSessionPlayer } from "@/lib/auth";
import { allowDemoData } from "@/lib/logos";
import { listPlayers, listStages } from "@/lib/queries";
import { cardClass } from "@/lib/ui";

export const metadata = { title: "Players" };

export default async function PlayersPage() {
  const player = await getSessionPlayer();
  if (!player) redirect("/");
  const includeDemo = allowDemoData() && (player.isDemo || (await demoCookieOn()));
  const [people, stages] = await Promise.all([listPlayers(includeDemo), listStages(includeDemo)]);
  const stage = stages.find((item) => !item.isDemo && item.picksOpen) ?? stages.find((item) => !item.isDemo) ?? stages[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Players</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Brackets stay hidden until that stage locks, one hour before the first match. Yours are always visible.
        </p>
      </div>
      <ul className="space-y-2">
        {people.map((person) => (
          <li key={person.id}>
            <Link
              href={stage ? `/players/${person.id}?stage=${stage.slug}` : `/players/${person.id}`}
              className={`${cardClass} flex items-center justify-between px-4 py-3`}
            >
              <span className="font-semibold">
                {person.displayName}
                {person.id === player.id ? <span className="ml-2 text-xs font-medium text-amber-200">you</span> : null}
              </span>
              <span className="text-sm font-semibold text-amber-300">View picks</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
