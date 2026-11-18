"use client";

import { useState, useTransition } from "react";
import { saveBracket } from "@/app/actions/picks";
import { resolveLogo } from "@/lib/logos";
import { picksFromPlayoff, projectPlayoff, type PlayoffPick } from "@/lib/playoff";
import { pairKey } from "@/lib/swiss";
import { ResetControl, SaveStatus } from "@/components/SaveState";
import { cx } from "@/lib/ui";

type Side = {
  teamId: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  seed: number;
};

export function PlayoffBracket({
  stageId,
  locked,
  readOnly = false,
  teams,
  initialPicks,
  finalFormat,
}: {
  stageId: string;
  locked: boolean;
  readOnly?: boolean;
  teams: Side[];
  initialPicks: PlayoffPick[];
  finalFormat: "bo3" | "bo5";
}) {
  const [picks, setPicks] = useState(initialPicks);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const board = projectPlayoff({ teams, picks, finalFormat });
  const byId = new Map(teams.map((team) => [team.teamId, team]));

  const frozen = locked || readOnly;

  function commit(next: PlayoffPick[]) {
    const clean = picksFromPlayoff(projectPlayoff({ teams, picks: next, finalFormat }).matches);
    setPicks(clean);
    if (frozen) return;
    setFailed(false);
    startTransition(async () => {
      const saved = await saveBracket(stageId, clean);
      setFailed(!saved?.ok);
    });
  }

  function choose(match: (typeof board.matches)[number], teamId: string) {
    if (frozen || !match.teamAId || !match.teamBId) return;
    const key = pairKey(match.teamAId, match.teamBId);
    const kept = picks.filter((pick) => pick.round < match.round || (pick.round === match.round && pairKey(pick.teamAId, pick.teamBId) !== key));
    commit([
      ...kept,
      { round: match.round, teamAId: match.teamAId, teamBId: match.teamBId, winnerId: teamId, scoreA: null, scoreB: null },
    ]);
  }

  const columns = [
    { title: "Quarterfinals", round: 1 },
    { title: "Semifinals", round: 2 },
    { title: "Final", round: 3 },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-zinc-400">Quarterfinals and semifinals are Bo3. The final is {finalFormat === "bo5" ? "Bo5" : "Bo3"}.</p>
        {readOnly ? (
          <span className="text-[11px] font-semibold text-zinc-500">View only</span>
        ) : (
          <div className="flex items-center gap-3">
            <SaveStatus locked={locked} pending={pending} failed={failed} />
            <ResetControl disabled={locked || picks.length === 0} onReset={() => commit([])} />
          </div>
        )}
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-6">
          {columns.map((column) => (
            <section key={column.round} className="w-52 space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">{column.title}</h2>
              {board.matches
                .filter((match) => match.round === column.round)
                .map((match) => (
                  <article key={match.label} className="space-y-1 rounded-2xl border border-white/10 bg-[#1a2230] p-2">
                    <p className="text-[10px] text-zinc-500">
                      {match.label} · {match.format === "bo5" ? "Bo5" : "Bo3"}
                    </p>
                    {[match.teamAId, match.teamBId].map((teamId) => {
                      const team = teamId ? byId.get(teamId) : null;
                      const selected = Boolean(team && match.winnerId === team.teamId);
                      return (
                        <button
                          key={teamId ?? `${match.label}-empty`}
                          type="button"
                          disabled={frozen || !team}
                          onClick={() => team && choose(match, team.teamId)}
                          className={cx(
                            "flex h-11 w-full items-center gap-2 rounded-xl px-2 text-left",
                            selected ? "bg-emerald-400/15 ring-1 ring-emerald-300" : "bg-white/5",
                          )}
                        >
                          <Mark team={team} />
                          <span className="truncate text-sm font-semibold">{team ? team.shortName : "Waiting"}</span>
                        </button>
                      );
                    })}
                  </article>
                ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function Mark({ team }: { team: Side | null | undefined }) {
  const [broken, setBroken] = useState(false);
  if (!team) return <span className="grid h-8 w-8 place-items-center rounded-full bg-zinc-800 text-[10px] text-zinc-500">?</span>;
  const logo = resolveLogo(team);
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-zinc-800 text-[10px] font-bold">
      {logo && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />
      ) : (
        team.shortName.slice(0, 3).toUpperCase()
      )}
    </span>
  );
}
