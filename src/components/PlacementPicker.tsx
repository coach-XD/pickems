"use client";

import { useMemo, useState } from "react";
import { savePlacements } from "@/app/actions/picks";
import { scorePlacementSlot } from "@/lib/scoring";
import { SLOT_LABEL, SLOT_LIMITS, SLOT_POINTS, type Slot } from "@/lib/types";
import { btnPrimary, cardClass, cx } from "@/lib/ui";
import { SubmitButton } from "./SubmitButton";
import { TeamBadge } from "./TeamBadge";

export type PickerTeam = {
  teamId: string;
  name: string;
  shortName: string;
  logoUrl: string | null;
  seed: number;
  worldRank: number | null;
};

const ORDER: Slot[] = ["perfect", "winless", "advance"];

export function PlacementPicker({
  stageId,
  slug,
  teams,
  initial,
  locked,
  records,
}: {
  stageId: string;
  slug: string;
  teams: PickerTeam[];
  initial: Array<{ teamId: string; slot: Slot }>;
  locked: boolean;
  records: Record<string, { wins: number; losses: number }>;
}) {
  const [active, setActive] = useState<Slot>("perfect");
  const [picks, setPicks] = useState<Record<string, Slot>>(() =>
    Object.fromEntries(initial.map((pick) => [pick.teamId, pick.slot])),
  );

  const counts = useMemo(() => {
    const tally = { perfect: 0, winless: 0, advance: 0 };
    for (const slot of Object.values(picks)) tally[slot] += 1;
    return tally;
  }, [picks]);

  const complete = ORDER.every((slot) => counts[slot] === SLOT_LIMITS[slot]);
  const payload = JSON.stringify(Object.entries(picks).map(([teamId, slot]) => ({ teamId, slot })));

  function assign(teamId: string) {
    if (locked) return;
    setPicks((current) => {
      const next = { ...current };
      if (next[teamId] === active) {
        delete next[teamId];
        return next;
      }
      const used = Object.values(next).filter((slot) => slot === active).length;
      if (used >= SLOT_LIMITS[active]) return current;
      next[teamId] = active;
      return next;
    });
  }

  return (
    <form action={savePlacements} className={`${cardClass} p-4`}>
      <input type="hidden" name="stageId" value={stageId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="picks" value={payload} />
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold">Stage picks</h2>
        <p className="text-xs text-zinc-500">{Object.keys(picks).length}/10</p>
      </div>
      <p className="mt-1 text-sm text-zinc-400">Two 3-0s, two 0-3s, and six teams to advance. A team can only sit in one slot.</p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {ORDER.map((slot) => (
          <button
            key={slot}
            type="button"
            disabled={locked}
            onClick={() => setActive(slot)}
            className={cx(
              "rounded-xl border px-2 py-2 text-left",
              active === slot ? "border-amber-400/70 bg-amber-400/10" : "border-white/10 bg-zinc-950/40",
            )}
          >
            <span className="block text-sm font-semibold">{SLOT_LABEL[slot]}</span>
            <span className="block text-[11px] text-zinc-400">
              {counts[slot]}/{SLOT_LIMITS[slot]} · {SLOT_POINTS[slot]} pts
            </span>
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {teams.map((team) => {
          const slot = picks[team.teamId];
          const record = records[team.teamId];
          const scored = slot && record ? scorePlacementSlot(slot, record.wins, record.losses) : null;
          return (
            <li key={team.teamId}>
              <button
                type="button"
                disabled={locked}
                onClick={() => assign(team.teamId)}
                className={cx(
                  "flex w-full items-center gap-3 rounded-xl border px-2 py-2 text-left",
                  slot === active && "border-amber-400/70 bg-amber-400/10",
                  slot && slot !== active && "border-white/10 bg-white/5",
                  !slot && "border-white/10",
                )}
              >
                <span className="w-8 shrink-0 text-center font-mono text-xs text-zinc-500">{team.seed}</span>
                <span className="min-w-0 flex-1">
                  <TeamBadge name={team.name} shortName={team.shortName} logoUrl={team.logoUrl} compact />
                </span>
                <span className="shrink-0 text-right">
                  {team.worldRank != null ? <span className="block text-[11px] text-zinc-500">#{team.worldRank}</span> : null}
                  {slot ? <span className="block text-xs font-semibold text-amber-200">{SLOT_LABEL[slot]}</span> : <span className="block text-xs text-zinc-600">Open</span>}
                  {scored?.correct === true ? <span className="block text-[11px] text-emerald-300">+{scored.points}</span> : null}
                  {scored?.correct === false ? <span className="block text-[11px] text-rose-300">0</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {locked ? (
        <p className="mt-4 text-sm text-rose-200">Stage picks are locked.</p>
      ) : (
        <div className="mt-4">
          <SubmitButton className={`${btnPrimary} w-full`} disabled={!complete}>
            Save stage picks
          </SubmitButton>
          {!complete ? <p className="mt-2 text-center text-xs text-zinc-500">Fill every slot before saving.</p> : null}
        </div>
      )}
    </form>
  );
}
