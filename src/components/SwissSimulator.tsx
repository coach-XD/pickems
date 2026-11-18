"use client";

import { useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { resolveLogo } from "@/lib/logos";
import { saveBracket } from "@/app/actions/picks";
import { derivedPlacements, picksFromBracket, projectBracket, type BracketPick, type RealSeries } from "@/lib/bracket";
import { pairKey } from "@/lib/swiss";
import { cx } from "@/lib/ui";

type SimTeam = {
  teamId: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  seed: number;
};

type Line = { x1: number; y1: number; x2: number; y2: number; win: boolean };

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
  const [lines, setLines] = useState<Line[]>([]);
  const [, startTransition] = useTransition();
  const boardRef = useRef<HTMLDivElement>(null);
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
    startTransition(async () => {
      await saveBracket(stageId, clean);
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

  useLayoutEffect(() => {
    const root = boardRef.current;
    if (!root) return;
    const draw = () => {
      const origin = root.getBoundingClientRect();
      const spots = [...root.querySelectorAll<HTMLElement>("[data-spot]")];
      const grouped = new Map<string, HTMLElement[]>();
      for (const spot of spots) {
        const teamId = spot.dataset.team;
        if (!teamId) continue;
        const list = grouped.get(teamId) ?? [];
        list.push(spot);
        grouped.set(teamId, list);
      }
      const next: Line[] = [];
      for (const list of grouped.values()) {
        const ordered = list.sort((a, b) => Number(a.dataset.step) - Number(b.dataset.step));
        for (let index = 0; index < ordered.length - 1; index += 1) {
          const from = ordered[index].getBoundingClientRect();
          const to = ordered[index + 1].getBoundingClientRect();
          next.push({
            x1: from.right - origin.left,
            y1: from.top + from.height / 2 - origin.top,
            x2: to.left - origin.left,
            y2: to.top + to.height / 2 - origin.top,
            win: ordered[index].dataset.result === "win",
          });
        }
      }
      setLines((current) => {
        if (
          current.length === next.length &&
          current.every((line, index) => line.x1 === next[index].x1 && line.y1 === next[index].y1 && line.x2 === next[index].x2 && line.win === next[index].win)
        ) {
          return current;
        }
        return next;
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(root);
    return () => observer.disconnect();
  }, [matches, placements]);

  const rounds = [...new Set(matches.map((match) => match.round))];
  const finished = placements.reduce<Record<string, string[]>>((groups, slot) => {
    const name = teamById.get(slot.teamId)?.shortName ?? slot.teamId;
    groups[slot.slot] = [...(groups[slot.slot] ?? []), name];
    return groups;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-xs">
          <SlateChip label="3-0" value={finished.perfect?.join(", ")} />
          <SlateChip label="0-3" value={finished.winless?.join(", ")} />
          <SlateChip label="Advance" value={finished.advance?.join(", ")} />
        </div>
        <button
          type="button"
          disabled={locked || picks.length === 0}
          onClick={() => commit([])}
          className="h-9 rounded-lg border border-white/15 px-3 text-xs font-semibold text-zinc-200 disabled:opacity-40"
        >
          Reset
        </button>
      </div>
      <div className="overflow-x-auto pb-2">
        <div ref={boardRef} className="relative flex min-w-max gap-3 px-1 md:min-w-0 md:w-full md:justify-between">
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            {lines.map((line, index) => (
              <path
                key={`${line.x1}-${line.y1}-${index}`}
                d={`M ${line.x1} ${line.y1} C ${(line.x1 + line.x2) / 2} ${line.y1}, ${(line.x1 + line.x2) / 2} ${line.y2}, ${line.x2} ${line.y2}`}
                fill="none"
                stroke={line.win ? "#3ee0b0" : "#ff5d73"}
                strokeWidth="2"
              />
            ))}
          </svg>
          {rounds.map((round) => {
            const inRound = matches.filter((match) => match.round === round);
            const records = [...new Set(inRound.map((match) => `${match.wins}-${match.losses}`))].sort((a, b) => {
              const [aw, al] = a.split("-").map(Number);
              const [bw, bl] = b.split("-").map(Number);
              return bw - aw || al - bl;
            });
            return (
              <section key={round} className="relative z-10 w-36 shrink-0 space-y-3 sm:w-40">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">Round {round}</h2>
                  <button
                    type="button"
                    disabled={locked || !picks.some((pick) => pick.round >= round)}
                    onClick={() => commit(picks.filter((pick) => pick.round < round))}
                    className="text-[11px] font-semibold text-zinc-400 disabled:opacity-40"
                  >
                    Reset
                  </button>
                </div>
                {records.map((record) => (
                  <div key={record} className="space-y-2">
                    <p className="text-[11px] font-semibold text-zinc-500">{record}</p>
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
                              "rounded-2xl border bg-[#1a2230] p-2",
                              verdict === "correct" && "border-emerald-400 bg-emerald-400/10",
                              verdict === "wrong" && "border-rose-400 bg-rose-500/10",
                              !verdict && "border-white/10",
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <Spot
                                team={teamById.get(match.teamAId)!}
                                step={round}
                                result={match.winnerId === match.teamAId ? "win" : match.winnerId ? "loss" : ""}
                                selected={match.winnerId === match.teamAId}
                                disabled={locked}
                                onClick={() => chooseWinner(match, match.teamAId)}
                              />
                              <span className="text-[10px] text-zinc-500">{match.format === "bo3" ? "Bo3" : "vs"}</span>
                              <Spot
                                team={teamById.get(match.teamBId)!}
                                step={round}
                                result={match.winnerId === match.teamBId ? "win" : match.winnerId ? "loss" : ""}
                                selected={match.winnerId === match.teamBId}
                                disabled={locked}
                                onClick={() => chooseWinner(match, match.teamBId)}
                              />
                            </div>
                            {match.format === "bo3" && match.winnerId ? (
                              <div className="mt-2 grid grid-cols-2 gap-1">
                                {(["2-0", "2-1"] as const).map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    disabled={locked}
                                    onClick={() => chooseMargin(match, option)}
                                    className={cx(
                                      "h-7 rounded-md text-[11px] font-semibold",
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
            step={6}
            groups={[
              ["3-0", placements.filter((slot) => slot.slot === "perfect").map((slot) => slot.teamId)],
              ["3-1 / 3-2", placements.filter((slot) => slot.slot === "advance").map((slot) => slot.teamId)],
            ]}
            teamById={teamById}
          />
          <ResultColumn
            title="Eliminated"
            tone="red"
            step={6}
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
  step,
  groups,
  extra = [],
  teamById,
}: {
  title: string;
  tone: "green" | "red";
  step: number;
  groups: Array<[string, string[]]>;
  extra?: Array<[string, string[]]>;
  teamById: Map<string, SimTeam>;
}) {
  const blocks = [...groups, ...extra].filter(([, ids]) => ids.length > 0);
  if (blocks.length === 0) return null;
  return (
    <section className="relative z-10 w-36 shrink-0 space-y-3 sm:w-40">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">{title}</h2>
      {blocks.map(([label, ids]) => (
        <div
          key={label}
          className={cx(
            "rounded-2xl border p-2",
            tone === "green" && label !== "3-1 / 3-2" && "border-emerald-400/50 bg-emerald-500/20",
            tone === "green" && label === "3-1 / 3-2" && "border-emerald-700/60 bg-emerald-900/50",
            tone === "red" && label === "0-3" && "border-rose-400/60 bg-rose-600/25",
            tone === "red" && label !== "0-3" && "border-rose-900/70 bg-rose-950/70",
          )}
        >
          <p className="mb-2 text-center text-[11px] font-semibold">{label}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {ids.map((teamId) => (
              <Spot key={teamId} team={teamById.get(teamId)!} step={step} result="" selected={false} disabled />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function Spot({
  team,
  step,
  result,
  selected,
  disabled,
  onClick,
}: {
  team: SimTeam;
  step: number;
  result: string;
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
      data-spot=""
      data-team={team.teamId}
      data-step={step}
      data-result={result}
      title={`${team.name} · seed ${team.seed}`}
      className="flex w-12 flex-col items-center gap-1 disabled:cursor-default"
    >
      <span
        className={cx(
          "grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-zinc-800 p-0.5 text-[10px] font-bold text-zinc-100",
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
      <span className="max-w-12 truncate text-[10px] text-zinc-300">{team.shortName}</span>
    </button>
  );
}

function SlateChip({ label, value }: { label: string; value?: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-zinc-300">
      <span className="text-zinc-500">{label}</span> {value || "—"}
    </span>
  );
}
