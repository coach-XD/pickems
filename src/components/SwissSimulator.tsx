"use client";

import { useMemo, useState, useTransition } from "react";
import { resolveLogo } from "@/lib/logos";
import { saveBracket } from "@/app/actions/picks";
import { derivedPlacements, picksFromBracket, projectBracket, type BracketPick, type RealSeries } from "@/lib/bracket";
import { displayOdds } from "@/lib/odds/price";
import { gradePlacementPick, gradeSeriesPick, type PlacementGrade } from "@/lib/results";
import { deriveStandings, pairKey } from "@/lib/swiss";
import type { Slot } from "@/lib/types";
import { ResetControl, SaveStatus } from "@/components/SaveState";
import { cx } from "@/lib/ui";

type SimTeam = {
  teamId: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  seed: number;
  worldRank?: number | null;
  vrsPoints?: number | null;
};

export function SwissSimulator({
  stageId,
  locked,
  readOnly = false,
  teams,
  round1,
  initialPicks,
  realMatches,
  realOdds = [],
}: {
  stageId: string;
  locked: boolean;
  readOnly?: boolean;
  teams: SimTeam[];
  round1: Array<{ teamAId: string; teamBId: string }>;
  initialPicks: BracketPick[];
  realMatches: RealSeries[];
  realOdds?: Array<{ teamAId: string; teamBId: string; oddsA: number; oddsB: number }>;
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
  const oddsByPair = useMemo(() => {
    const map = new Map<string, { teamAId: string; teamBId: string; oddsA: number; oddsB: number }>();
    for (const row of realOdds) map.set(pairKey(row.teamAId, row.teamBId), row);
    return map;
  }, [realOdds]);
  const realByPair = useMemo(() => {
    const map = new Map<string, RealSeries>();
    for (const match of realMatches) map.set(pairKey(match.teamAId, match.teamBId), match);
    return map;
  }, [realMatches]);
  const realRecords = useMemo(() => {
    const standings = deriveStandings(
      teams,
      realMatches.map((match) => ({
        round: match.round,
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        winnerId: match.winnerId,
      })),
    );
    return new Map(standings.map((row) => [row.teamId, row]));
  }, [teams, realMatches]);
  const showGrades = readOnly || realMatches.some((match) => match.winnerId);

  const frozen = locked || readOnly;

  function commit(next: BracketPick[]) {
    const clean = picksFromBracket(projectBracket({ teams, round1, picks: next }));
    setPicks(clean);
    if (frozen) return;
    setFailed(false);
    startTransition(async () => {
      const saved = await saveBracket(stageId, clean);
      setFailed(!saved?.ok);
    });
  }

  function chooseWinner(match: (typeof matches)[number], teamId: string) {
    if (frozen) return;
    const key = pairKey(match.teamAId, match.teamBId);
    const kept = picks.filter((pick) => pick.round < match.round || (pick.round === match.round && pairKey(pick.teamAId, pick.teamBId) !== key));
    commit([
      ...kept,
      { round: match.round, teamAId: match.teamAId, teamBId: match.teamBId, winnerId: teamId, scoreA: null, scoreB: null },
    ]);
  }

  function chooseMargin(match: (typeof matches)[number], margin: "2-0" | "2-1") {
    if (frozen || !match.winnerId) return;
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
        {readOnly ? (
          <span className="text-[11px] font-semibold text-zinc-500">View only</span>
        ) : (
          <div className="flex items-center gap-3">
            <SaveStatus locked={locked} pending={pending} failed={failed} />
            <ResetControl disabled={locked || picks.length === 0} label="Reset bracket" onReset={() => commit([])} />
          </div>
        )}
      </div>
      <div className="min-w-0 overflow-x-auto pb-1">
        <div className="flex w-max gap-2 pr-2">
          {rounds.map((round) => {
            const inRound = matches.filter((match) => match.round === round);
            const records = [...new Set(inRound.map((match) => `${match.wins}-${match.losses}`))].sort((a, b) => {
              const [aw, al] = a.split("-").map(Number);
              const [bw, bl] = b.split("-").map(Number);
              return bw - aw || al - bl;
            });
            return (
              <section key={round} className="w-[10.25rem] shrink-0 space-y-1 overflow-hidden xl:w-[12rem]">
                <div className="flex items-center justify-between gap-1">
                  <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 xl:text-xs">Round {round}</h2>
                  {readOnly ? null : (
                  <button
                    type="button"
                    title="Reset this round"
                    aria-label={`Reset round ${round}`}
                    disabled={frozen || !picks.some((pick) => pick.round >= round)}
                    onClick={() => commit(picks.filter((pick) => pick.round < round))}
                    className="grid h-5 w-5 shrink-0 place-items-center rounded text-zinc-500 hover:bg-white/10 hover:text-zinc-100 disabled:opacity-30"
                  >
                    <ResetIcon />
                  </button>
                  )}
                </div>
                {records.map((record) => (
                  <div key={record} className="space-y-0.5">
                    <p className="text-[10px] font-semibold text-zinc-500">{record}</p>
                    {inRound
                      .filter((match) => `${match.wins}-${match.losses}` === record)
                      .map((match) => {
                        const real = realByPair.get(pairKey(match.teamAId, match.teamBId));
                        const grade = showGrades
                          ? gradeSeriesPick({
                              format: real?.format ?? match.format,
                              pickWinnerId: match.winnerId,
                              pickScoreA: match.scoreA,
                              pickScoreB: match.scoreB,
                              resultWinnerId: real?.winnerId ?? null,
                              resultScoreA: real?.scoreA ?? null,
                              resultScoreB: real?.scoreB ?? null,
                            })
                          : null;
                        const verdict = grade && grade.tone !== "empty" && grade.tone !== "pending" ? grade.tone : null;
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
                                disabled={frozen}
                                onClick={() => chooseWinner(match, match.teamAId)}
                              />
                              <span className="text-[10px] text-zinc-500">{match.format === "bo3" ? "Bo3" : "vs"}</span>
                              <Spot
                                team={teamById.get(match.teamBId)!}
                                selected={match.winnerId === match.teamBId}
                                disabled={frozen}
                                onClick={() => chooseWinner(match, match.teamBId)}
                              />
                            </div>
                            <OddsRow
                              teamA={teamById.get(match.teamAId)}
                              teamB={teamById.get(match.teamBId)}
                              stored={oddsByPair.get(pairKey(match.teamAId, match.teamBId))}
                            />
                            {match.format === "bo3" && match.winnerId ? (
                              <div className="mt-0.5 grid grid-cols-2 gap-0.5">
                                {(["2-0", "2-1"] as const).map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    disabled={frozen}
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
                            {grade && grade.tone !== "empty" ? (
                              <p
                                className={cx(
                                  "mt-0.5 text-center text-[10px] font-semibold",
                                  grade.tone === "correct" && "text-emerald-200",
                                  grade.tone === "wrong" && "text-rose-200",
                                  grade.tone === "pending" && "text-zinc-500",
                                )}
                              >
                                {real?.winnerId && real.scoreA != null ? `Final ${real.scoreA}-${real.scoreB} · ` : ""}
                                {grade.tone === "pending" ? "Pending" : grade.exact ? `+${grade.points} exact` : grade.tone === "correct" ? `+${grade.points}` : "0"}
                              </p>
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
            gradeFor={showGrades ? (teamId, label) => placementGrade(teamId, label, realRecords) : undefined}
          />
          <ResultColumn
            title="Eliminated"
            tone="red"
            groups={[["0-3", placements.filter((slot) => slot.slot === "winless").map((slot) => slot.teamId)]]}
            teamById={teamById}
            gradeFor={showGrades ? (teamId, label) => placementGrade(teamId, label, realRecords) : undefined}
            extra={eliminatedRecords(teams, matches)}
          />
        </div>
      </div>
      <p className="text-[10px] text-zinc-500">Odds for fun · don&apos;t affect scoring. PROJ marks a price with no book line.</p>
    </div>
  );
}

function OddsRow({
  teamA,
  teamB,
  stored,
}: {
  teamA?: SimTeam;
  teamB?: SimTeam;
  stored?: { teamAId: string; teamBId: string; oddsA: number; oddsB: number };
}) {
  if (!teamA || !teamB) return null;
  const sameOrder = !stored || stored.teamAId === teamA.teamId;
  const line = displayOdds({
    pointsA: teamA.vrsPoints,
    pointsB: teamB.vrsPoints,
    realA: stored ? (sameOrder ? stored.oddsA : stored.oddsB) : null,
    realB: stored ? (sameOrder ? stored.oddsB : stored.oddsA) : null,
  });
  if (!line) return null;
  return (
    <div className="mt-1 flex items-center justify-center gap-1">
      <OddsPill odds={line.oddsA} percent={line.percentA} favorite={line.oddsA <= line.oddsB} />
      <OddsPill odds={line.oddsB} percent={line.percentB} favorite={line.oddsB < line.oddsA} />
      {line.projected ? <span className="text-[8px] font-semibold uppercase tracking-wide text-zinc-500">Proj</span> : null}
    </div>
  );
}

function OddsPill({ odds, percent, favorite }: { odds: number; percent: number; favorite: boolean }) {
  return (
    <span
      className={cx(
        "rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums",
        favorite ? "bg-amber-400/20 text-amber-100" : "bg-white/5 text-zinc-400",
      )}
    >
      {odds.toFixed(2)} · {percent}%
    </span>
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

function placementGrade(
  teamId: string,
  label: string,
  records: Map<string, { wins: number; losses: number }>,
): PlacementGrade | null {
  const slot: Slot | null = label === "3-0" ? "perfect" : label === "0-3" ? "winless" : label === "3-1 / 3-2" ? "advance" : null;
  if (!slot) return null;
  const record = records.get(teamId) ?? { wins: 0, losses: 0 };
  return gradePlacementPick(slot, record.wins, record.losses);
}

function ResultColumn({
  title,
  tone,
  groups,
  extra = [],
  teamById,
  gradeFor,
}: {
  title: string;
  tone: "green" | "red";
  groups: Array<[string, string[]]>;
  extra?: Array<[string, string[]]>;
  teamById: Map<string, SimTeam>;
  gradeFor?: (teamId: string, label: string) => PlacementGrade | null;
}) {
  const blocks = [...groups, ...extra].filter(([, ids]) => ids.length > 0);
  if (blocks.length === 0) return null;
  return (
    <section className="w-[11.5rem] shrink-0 space-y-1.5">
      <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400 xl:text-xs">{title}</h2>
      {blocks.map(([label, ids]) => (
        <div
          key={label}
          className={cx(
            "rounded-lg border p-1.5",
            tone === "green" && label !== "3-1 / 3-2" && "border-emerald-400/50 bg-emerald-500/20",
            tone === "green" && label === "3-1 / 3-2" && "border-emerald-700/60 bg-emerald-900/50",
            tone === "red" && label === "0-3" && "border-rose-400/60 bg-rose-600/25",
            tone === "red" && label !== "0-3" && "border-rose-900/70 bg-rose-950/70",
          )}
        >
          <p className="mb-1 text-center text-[10px] font-semibold">{label}</p>
          <div className="flex flex-wrap gap-x-2 gap-y-1">
            {ids.map((teamId) => (
              <PoolChip key={teamId} team={teamById.get(teamId)!} grade={gradeFor?.(teamId, label) ?? null} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function PoolChip({ team, grade }: { team: SimTeam; grade?: PlacementGrade | null }) {
  const [broken, setBroken] = useState(false);
  const logo = resolveLogo(team);
  return (
    <span className="inline-flex max-w-full items-center gap-1" title={team.name}>
      <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded bg-zinc-800">
        {logo && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />
        ) : (
          <span className="text-[8px] font-bold text-zinc-200">{team.shortName.slice(0, 2)}</span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-medium leading-none text-white">{team.shortName}</span>
        {grade ? (
          <span
            className={cx(
              "block text-[9px] font-semibold leading-tight",
              grade.tone === "correct" && "text-emerald-200",
              grade.tone === "wrong" && "text-rose-200",
              grade.tone === "pending" && "text-zinc-500",
            )}
          >
            {grade.tone === "pending" ? "pending" : grade.tone === "correct" ? `+${grade.points}` : "0"}
          </span>
        ) : null}
      </span>
    </span>
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
      title={`${team.name} · seed ${team.seed}${team.worldRank != null ? ` · VRS #${team.worldRank}` : ""}`}
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
