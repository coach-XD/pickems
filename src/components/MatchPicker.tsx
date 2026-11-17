"use client";

import { useState } from "react";
import { saveMatchPick } from "@/app/actions/picks";
import { btnGhost, cardClass, cx } from "@/lib/ui";
import { Countdown } from "./Countdown";
import { LocalTime } from "./LocalTime";
import { TeamBadge } from "./TeamBadge";

type Side = {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  seed: number;
};

export function MatchPicker({
  slug,
  matchId,
  round,
  format,
  scheduledAt,
  lockIso,
  locked,
  teamA,
  teamB,
  saved,
  resultLabel,
  pointsLabel,
}: {
  slug: string;
  matchId: string;
  round: number;
  format: "bo1" | "bo3";
  scheduledAt: string;
  lockIso: string;
  locked: boolean;
  teamA: Side;
  teamB: Side;
  saved: { winnerId: string; scoreA: number | null; scoreB: number | null } | null;
  resultLabel: string | null;
  pointsLabel: string | null;
}) {
  const [winner, setWinner] = useState(saved?.winnerId ?? "");
  const savedMargin =
    saved && saved.scoreA != null && saved.scoreB != null
      ? Math.min(saved.scoreA, saved.scoreB) === 0
        ? "2-0"
        : "2-1"
      : null;

  return (
    <article id={`m-${matchId}`} className={`${cardClass} scroll-mt-4 p-4`}>
      <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
        <p>
          Round {round} · {format === "bo3" ? "Bo3" : "Bo1"}
        </p>
        <Countdown lockIso={lockIso} />
      </div>
      <p className="mt-1 text-sm text-zinc-300">
        <LocalTime iso={scheduledAt} />
      </p>
      {resultLabel ? <p className="mt-2 text-sm font-medium text-emerald-200">{resultLabel}</p> : null}

      <form action={saveMatchPick} className="mt-3 space-y-2">
        <input type="hidden" name="matchId" value={matchId} />
        <input type="hidden" name="slug" value={slug} />
        {format === "bo3" ? <input type="hidden" name="winnerId" value={winner} /> : null}
        <div className="grid grid-cols-2 gap-2">
          {[teamA, teamB].map((team) => {
            const selected = winner === team.id;
            const common = cx(
              "min-h-16 rounded-xl border px-2 py-2 text-left",
              selected ? "border-amber-400 bg-amber-400/15" : "border-white/10 bg-zinc-950/40",
            );
            if (format === "bo1") {
              return (
                <button key={team.id} type="submit" name="winnerId" value={team.id} disabled={locked} className={common}>
                  <TeamBadge name={team.name} shortName={team.shortName} logoUrl={team.logoUrl} seed={team.seed} compact />
                </button>
              );
            }
            return (
              <button key={team.id} type="button" disabled={locked} onClick={() => setWinner(team.id)} className={common}>
                <TeamBadge name={team.name} shortName={team.shortName} logoUrl={team.logoUrl} seed={team.seed} compact />
              </button>
            );
          })}
        </div>
        {format === "bo3" && !locked ? (
          <div className="grid grid-cols-2 gap-2">
            {(["2-0", "2-1"] as const).map((margin) => (
              <button
                key={margin}
                type="submit"
                name="margin"
                value={margin}
                disabled={!winner}
                className={cx(btnGhost, "h-11", savedMargin === margin && winner === saved?.winnerId && "border-amber-400/60 text-amber-100")}
              >
                {margin}
              </button>
            ))}
          </div>
        ) : null}
        {format === "bo3" && locked && savedMargin ? <p className="text-sm text-zinc-300">Your score: {savedMargin}</p> : null}
        {!locked && saved ? (
          <button type="submit" name="clear" value="1" className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-200 hover:underline">
            Clear pick
          </button>
        ) : null}
      </form>
      {pointsLabel ? <p className="mt-3 text-xs font-semibold text-zinc-300">{pointsLabel}</p> : null}
    </article>
  );
}
