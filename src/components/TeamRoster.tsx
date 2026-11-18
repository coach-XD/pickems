"use client";

import { useState, type ReactNode } from "react";
import { resolveLogo } from "@/lib/logos";
import { formatRating, ratingClass, ratingTone } from "@/lib/rating";
import type { StageRosterTeam } from "@/lib/queries";
import { cx } from "@/lib/ui";

export function PicksFrame({ teams, children }: { teams: StageRosterTeam[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const showRoster = teams.length > 0;
  return (
    <div className="flex flex-col items-start gap-3 xl:flex-row">
      {showRoster ? (
        <aside className={cx("w-full xl:order-first xl:w-[300px] xl:shrink-0", open ? "order-last block" : "hidden xl:block")}>
          <RosterGrid teams={teams} />
        </aside>
      ) : null}
      <div className="w-full min-w-0 xl:flex-1">
        {showRoster ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="mb-2 h-8 rounded-lg border border-white/15 px-3 text-xs font-semibold text-zinc-200 xl:hidden"
          >
            {open ? "Hide teams" : "Teams"}
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function RosterGrid({ teams }: { teams: StageRosterTeam[] }) {
  return (
    <div>
      <div className="grid grid-cols-2 content-start gap-1">
        {teams.map((team) => (
          <TeamCard key={team.teamId} team={team} />
        ))}
      </div>
      <p className="mt-1 text-center text-[10px] leading-tight text-zinc-500">HLTV Rating 3.0 · time on current team</p>
    </div>
  );
}

function TeamCard({ team }: { team: StageRosterTeam }) {
  const logo = resolveLogo(team);
  return (
    <article className="rounded-md border border-white/10 bg-zinc-900/80 px-1.5 py-0.5">
      <div className="flex items-center gap-1">
        <span className="grid h-4 w-4 shrink-0 place-items-center overflow-hidden rounded bg-zinc-800">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[8px] font-bold text-zinc-300">{team.shortName.slice(0, 2)}</span>
          )}
        </span>
        <p className="min-w-0 flex-1 truncate text-[11px] font-semibold leading-none text-white" title={team.name}>
          {team.name}
        </p>
        <p className="shrink-0 text-[11px] font-semibold leading-none text-white">#{team.seed}</p>
      </div>
      <ul className="mt-0.5">
        {team.players.map((player) => (
          <li key={player.id} className="flex items-baseline justify-between gap-1 text-[11px] leading-[12px]">
            <span className="min-w-0 truncate text-zinc-300">{player.nickname}</span>
            <span className={cx("shrink-0 tabular-nums", ratingClass(ratingTone(player.rating)))}>{formatRating(player.rating)}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
