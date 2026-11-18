"use client";

import { useState } from "react";
import { attachTeams } from "@/app/actions/admin";
import { SubmitButton } from "@/components/SubmitButton";
import { btnPrimary, cardClass } from "@/lib/ui";

type CatalogTeam = { id: string; name: string; shortName: string };

export function BulkTeamAdd({
  stageId,
  teams,
  nextSeed,
}: {
  stageId: string;
  teams: CatalogTeam[];
  nextSeed: number;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const picked = new Set(order);

  function toggle(id: string) {
    setOrder((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function move(index: number, direction: -1 | 1) {
    setOrder((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  if (teams.length === 0) return null;
  const byId = new Map(teams.map((team) => [team.id, team]));

  return (
    <form action={attachTeams} className={`${cardClass} space-y-3 p-4`}>
      <div>
        <h3 className="font-semibold">Add teams from earlier stages</h3>
        <p className="mt-1 text-sm text-zinc-400">
          Tick the eight teams coming through, then set their seeds. New invited teams go in the form below.
        </p>
      </div>
      <input type="hidden" name="stageId" value={stageId} />
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {teams.map((team) => (
          <label key={team.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
            <input type="checkbox" checked={picked.has(team.id)} onChange={() => toggle(team.id)} />
            <span className="truncate">
              <span className="font-semibold">{team.shortName}</span>
              <span className="text-zinc-400"> {team.name}</span>
            </span>
          </label>
        ))}
      </div>
      {order.length > 0 ? (
        <ol className="space-y-2">
          {order.map((id, index) => {
            const team = byId.get(id);
            if (!team) return null;
            return (
              <li key={id} className="flex items-center gap-2">
                <input type="hidden" name="teamId" value={id} />
                <input
                  name={`seed_${id}`}
                  defaultValue={nextSeed + index}
                  aria-label={`Seed for ${team.name}`}
                  className="h-9 w-14 shrink-0 rounded-lg border border-white/10 bg-zinc-950 px-2 text-center text-sm text-zinc-100"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{team.name}</span>
                <button type="button" onClick={() => move(index, -1)} className="text-xs text-zinc-400" aria-label="Move up">
                  Up
                </button>
                <button type="button" onClick={() => move(index, 1)} className="text-xs text-zinc-400" aria-label="Move down">
                  Down
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-zinc-500">No teams selected yet.</p>
      )}
      <SubmitButton className={btnPrimary} disabled={order.length === 0}>
        Add {order.length || ""} selected
      </SubmitButton>
    </form>
  );
}
