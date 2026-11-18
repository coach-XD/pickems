"use client";

import { useMemo, useState, useTransition } from "react";
import { resolveLogo } from "@/lib/logos";
import { saveBracket } from "@/app/actions/picks";
import { derivedPlacements, picksFromBracket, projectBracket, type BracketPick, type RealSeries } from "@/lib/bracket";
import { pairKey } from "@/lib/swiss";
import { ResetControl, SaveStatus } from "@/components/SaveState";
import { cx } from "@/lib/ui";

type SimTeam = {
  teamId: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  seed: number;
};

export function SwissSimulator({
  stageId,
  locked,
  teams,
  round1,
  initialPicks,
  realMatches,
}: {
  stageId: string;
  locked: boolean;
  teams: SimTeam[];
  round1: Array<{ teamAId: string; teamBId: string }>;
  initialPicks: BracketPick[];
  realMatches: RealSeries[];
}) {
  const [picks, setPicks] = useState(initialPicks);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const teamById = useMemo(() => new Map(teams.map((team) => [team.teamId, team])), [teams]);
  const matches = useMemo(
    () => projectBracket({ teams, round1, picks }),
    [teams, round1, picks],
  );
  const placements = useMemo(() => derivedPlacements(teams, matches), [teams, matches]);
  const realByPair = useMemo(() => {
    const map = new Map<string, RealSeries>();
    for (const match of realMatches) map.set(pairKey(match.teamAId, match.teamBId), match);
    return map;
  }, [realMatches]);

  function commit(next: BracketPick[]) {
    const clean = picksFromBracket(projectBracket({ teams, round1, picks: next }));
    setPicks(clean);
    if (locked) return;
    setFailed(false);
    startTransition(async () => {
      const saved = await saveBracket(stageId, clean);
      setFailed(!saved?.ok);
    });
  }

  function chooseWinner(match: (typeof matches)[number], teamId: string) {
    if (locked) return;
    const key = pairKey(match.teamAId, match.teamBId);
    const kept = picks.filter((pick) => pick.round < match.round || (pick.round === match.round && pairKey(pick.teamAId, pick.teamBId) !== key));
    commit([
      ...kept,
      { round: match.round, teamAId: match.teamAId, teamBId: match.teamBId, winnerId: teamId, scoreA: null, scoreB: null },
    ]);
  }

  function chooseMargin(match: (typeof matches)[number], margin: "2-0" | "2-1") {
    if (locked || !match.winnerId) return;
    const key = pairKey(match.teamAId, match.teamBId);
    const loser = margin === "2-0" ? 0 : 1;
    const winnerIsA = match.winnerId === match.teamAId;
    commit(
      picks.map((pick) =>
        pick.round === match.round && pairKey(pick.teamAId, pick.teamBId) === key
          ? { ...pick, scoreA: winnerIsA ? 2 : loser, scoreB: winnerIsA ? loser : 2 }
          : pick,
      ),
    );
  }

  const rounds = [...new Set(matches.map((match) => match.round))];
  const finished = placements.reduce<Record<string, string[]>>((groups, slot) => {
    const name = teamById.get(slot.teamId)?.shortName ?? slot.teamId;
    groups[slot.slot] = [...(groups[slot.slot] ?? []), name];
    return groups;
  }, {});

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <SlateChip label="3-0" value={finished.perfect?.join(", ")} />
          <SlateChip label="0-3" value={finished.winless?.join(", ")} />
          <SlateChip label="Advance" value={finished.advance?.join(", ")} />
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus locked={locked} pending={pending} failed={failed} />
          <ResetControl disabled={locked || picks.length === 0} label="Reset bracket" onReset={() => commit([])} />
        </div>
      </div>
      <div className="no-scrollbar overflow-x-auto pb-1">
        <div className="flex w-max gap-3 xl:w-full xl:justify-between">
          {rounds.map((round) => {
            const inRound = matches.filter((match) => match.round === round);
            const records = [...new Set(inRound.map((match) => `${match.wins}-${match.losses}`))].sort((a, b) => {
              const [aw, al] = a.split("-").map(Number);
              const [bw, bl] = b.split("-").map(Number);
              return bw - aw || al - bl;
            });
            return (
              <section key={round} className="w-[11rem] shrink-0 space-y-1 overflow-hidden xl:w-[12.5rem]">
                <div className="flex items-center justify-between gap-1">
                  <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 xl:text-xs">Round {round}</h2>
                  <button
                    type="button"
                    title="Reset this round"
                    aria-label={`Reset round ${round}`}
                    disabled={locked || !picks.some((pick) => pick.round >= round)}
                    onClick={() => commit(picks.filter((pick) => pick.round < round))}
                    className="grid h-5 w-5 shrink-0 place-items-center rounded text-zinc-500 hover:bg-white/10 hover:text-zinc-100 disabled:opacity-30"
                  >
                    <ResetIcon />
                  </button>
                </div>
                {records.map((record) => (
                  <div key={record} className="space-y-0.5">
                    <p className="text-[10px] font-semibold text-zinc-500">{record}</p>
                    {inRound
                      .filter((match) => `${match.wins}-${match.losses}` === record)
                      .map((match) => {
                        const real = realByPair.get(pairKey(match.teamAId, match.teamBId));
                        const verdict =
                          locked && match.winnerId && real?.winnerId
                            ? real.winnerId === match.winnerId
                              ? "correct"
                              : "wrong"
                            : null;
                        const margin =
                          match.scoreA != null && match.scoreB != null
                            ? `${Math.max(match.scoreA, match.scoreB)}-${Math.min(match.scoreA, match.scoreB)}`
                            : null;
                        return (
                          <article
                            key={`${match.round}-${match.teamAId}-${match.teamBId}`}
                            className={cx(
                              "rounded-xl border bg-[#1a2230] p-1 transition-colors duration-150",
                              verdict === "correct" && "border-emerald-400 bg-emerald-400/10",
                              verdict === "wrong" && "border-rose-400 bg-rose-500/10",
                              !verdict && "border-white/10",
                            )}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <Spot
                                team={teamById.get(match.teamAId)!}
                                selected={match.winnerId === match.teamAId}
                                disabled={locked}
                                onClick={() => chooseWinner(match, match.teamAId)}
                              />
                              <span className="text-[10px] text-zinc-500">{match.format === "bo3" ? "Bo3" : "vs"}</span>
                              <Spot
                                team={teamById.get(match.teamBId)!}
                                selected={match.winnerId === match.teamBId}
                                disabled={locked}
                                onClick={() => chooseWinner(match, match.teamBId)}
                              />
                            </div>
                            {match.format === "bo3" && match.winnerId ? (
                              <div className="mt-0.5 grid grid-cols-2 gap-0.5">
                                {(["2-0", "2-1"] as const).map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    disabled={locked}
                                    onClick={() => chooseMargin(match, option)}
                                    className={cx(
                                      "h-5 rounded text-[11px] font-semibold",
                                      margin === option ? "bg-amber-400 text-zinc-950" : "bg-white/5 text-zinc-300",
                                    )}
                                  >
                                    {option}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                  </div>
                ))}
              </section>
            );
          })}
          <ResultColumn
            title="Advanced"
            tone="green"
            groups={[
              ["3-0", placements.filter((slot) => slot.slot === "perfect").map((slot) => slot.teamId)],
              ["3-1 / 3-2", placements.filter((slot) => slot.slot === "advance").map((slot) => slot.teamId)],
            ]}
            teamById={teamById}
          />
          <ResultColumn
            title="Eliminated"
            tone="red"
            groups={[["0-3", placements.filter((slot) => slot.slot === "winless").map((slot) => slot.teamId)]]}
            teamById={teamById}
            extra={eliminatedRecords(teams, matches)}
          />
        </div>
      </div>
    </div>
  );
}

function eliminatedRecords(
  teams: Array<{ teamId: string; seed: number }>,
  matches: ReturnType<typeof projectBracket>,
): Array<[string, string[]]> {
  const wins = new Map(teams.map((team) => [team.teamId, 0]));
  const losses = new Map(teams.map((team) => [team.teamId, 0]));
  for (const match of matches) {
    if (!match.winnerId) continue;
    const loser = match.winnerId === match.teamAId ? match.teamBId : match.teamAId;
    wins.set(match.winnerId, (wins.get(match.winnerId) ?? 0) + 1);
    losses.set(loser, (losses.get(loser) ?? 0) + 1);
  }
  const oneThree: string[] = [];
  const twoThree: string[] = [];
  for (const team of teams) {
    const won = wins.get(team.teamId) ?? 0;
    const lost = losses.get(team.teamId) ?? 0;
    if (lost >= 3 && won === 1) oneThree.push(team.teamId);
    if (lost >= 3 && won === 2) twoThree.push(team.teamId);
  }
  return [
    ["1-3", oneThree],
    ["2-3", twoThree],
  ];
}

function ResultColumn({
  title,
  tone,
  groups,
  extra = [],
  teamById,
}: {
  title: string;
  tone: "green" | "red";
  groups: Array<[string, string[]]>;
  extra?: Array<[string, string[]]>;
  teamById: Map<string, SimTeam>;
}) {
  const blocks = [...groups, ...extra].filter(([, ids]) => ids.length > 0);
  if (blocks.length === 0) return null;
  return (
    <section className="w-[11rem] shrink-0 space-y-1.5 overflow-hidden xl:w-[12.5rem]">
      <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 xl:text-xs">{title}</h2>
      {blocks.map(([label, ids]) => (
        <div
          key={label}
          className={cx(
            "rounded-lg border p-1",
            tone === "green" && label !== "3-1 / 3-2" && "border-emerald-400/50 bg-emerald-500/20",
            tone === "green" && label === "3-1 / 3-2" && "border-emerald-700/60 bg-emerald-900/50",
            tone === "red" && label === "0-3" && "border-rose-400/60 bg-rose-600/25",
            tone === "red" && label !== "0-3" && "border-rose-900/70 bg-rose-950/70",
          )}
        >
          <p className="mb-1 text-center text-[10px] font-semibold">{label}</p>
          <div className="flex flex-wrap justify-center gap-1">
            {ids.map((teamId) => (
              <Spot key={teamId} team={teamById.get(teamId)!} selected={false} disabled />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function Spot({
  team,
  selected,
  disabled,
  onClick,
}: {
  team: SimTeam;
  selected: boolean;
  disabled: boolean;
  onClick?: () => void;
}) {
  const [broken, setBroken] = useState(false);
  const logo = resolveLogo(team);
  return (
    <button
      type="button"
      disabled={disabled || !onClick}
      onClick={onClick}
      title={`${team.name} · seed ${team.seed}`}
      className="flex min-w-0 flex-1 flex-col items-center gap-1 disabled:cursor-default"
    >
      <span
        className={cx(
          "grid h-9 w-9 place-items-center overflow-hidden rounded-lg bg-zinc-800 p-0.5 text-[10px] font-bold text-zinc-100 transition-shadow duration-150",
          selected && "ring-2 ring-emerald-300",
        )}
      >
        {logo && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />
        ) : (
          team.shortName.slice(0, 3).toUpperCase()
        )}
      </span>
      <span className="w-full truncate text-center text-[11px] leading-none text-zinc-200">{team.shortName}</span>
    </button>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
      <path
        d="M3 8a5 5 0 1 0 1.2-3.2M3 2.5V5.5H6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SlateChip({ label, value }: { label: string; value?: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-zinc-300">
      <span className="text-zinc-500">{label}</span> {value || "—"}
    </span>
  );
}
