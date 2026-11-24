import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addMatch,
  addTeam,
  createSuggestedRound,
  deleteMatch,
  removeTeam,
  saveMatchOdds,
  saveTeams,
  setResult,
  updateMatch,
  updateStage,
} from "@/app/actions/admin";
import { ConfirmForm } from "@/components/ConfirmForm";
import { TeamBadge } from "@/components/TeamBadge";
import { Flash } from "@/components/Flash";
import { LocalTime } from "@/components/LocalTime";
import { SubmitButton } from "@/components/SubmitButton";
import { UtcDateTimeField } from "@/components/UtcDateTimeField";
import { BulkTeamAdd } from "@/components/BulkTeamAdd";
import { LogoField } from "@/components/LogoField";
import { getStageById, listStageOdds, listTeamsOutsideStage, stageBundle, type StageTeamView } from "@/lib/queries";
import { pairNextRound } from "@/lib/valveSwiss";
import { staggerFrom } from "@/lib/time";
import { btnDanger, btnGhost, btnPrimary, cardClass, inputClass, labelClass, selectClass } from "@/lib/ui";

export const metadata = { title: "Edit stage" };

export default async function EditStagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const stage = await getStageById(id);
  if (!stage) notFound();
  const bundle = await stageBundle(stage.id);
  const outside = await listTeamsOutsideStage(stage.id);
  const odds = await listStageOdds(stage.id);
  const oddsByMatch = new Map(odds.map((row) => [row.matchId, row]));
  const latestRound = bundle.matches.reduce((max, match) => Math.max(max, match.round), 0);
  const latestOpen = bundle.matches.some((match) => match.round === latestRound && !match.winnerId);
  const active = bundle.standings.filter((row) => row.status === "active");
  const nextRound = latestRound + 1;
  const suggestion =
    !latestOpen && active.length > 0 && nextRound <= 5
      ? pairNextRound({
          teams: bundle.teams.map((team) => ({ teamId: team.teamId, seed: team.seed })),
          completed: bundle.matches.flatMap((match) =>
            match.winnerId
              ? [{ round: match.round, teamAId: match.teamAId, teamBId: match.teamBId, winnerId: match.winnerId }]
              : [],
          ),
          round: nextRound,
        })
      : null;
  const lastMatch = bundle.matches[bundle.matches.length - 1];
  const suggestStart = lastMatch ? new Date(lastMatch.scheduledAt.getTime() + 24 * 60 * 60 * 1000) : stage.startsAt;
  const rounds = [...new Set(bundle.matches.map((match) => match.round))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{stage.name}</h1>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-zinc-400">
          <li>Add teams and seeds. Reuse a team from an earlier stage, or add a new one.</li>
          <li>Edit nicknames and ratings on Rosters.</li>
          <li>The bracket locks one hour before the first Round 1 match. Set that time on the match.</li>
          <li>Open for picks when the slate is ready. Enter the winner and map score after each series.</li>
        </ol>
      </div>
      <Flash error={query.error} notice={query.notice} />

      <form action={updateStage} className={`${cardClass} space-y-3 p-4`}>
        <input type="hidden" name="stageId" value={stage.id} />
        <label className="block">
          <span className={labelClass}>Name</span>
          <input name="name" defaultValue={stage.name} required className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Starts</span>
          <UtcDateTimeField name="startsAt" defaultIso={stage.startsAt.toISOString()} required />
        </label>
        <label className="block">
          <span className={labelClass}>Ends</span>
          <UtcDateTimeField name="endsAt" defaultIso={stage.endsAt?.toISOString()} />
        </label>
        <label className="block">
          <span className={labelClass}>Sort order</span>
          <input name="sortOrder" defaultValue={stage.sortOrder} required className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Picks</span>
          <select name="picksOpen" defaultValue={stage.picksOpen ? "1" : "0"} className={selectClass}>
            <option value="0">Locked</option>
            <option value="1">Open for picks</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Show picks before lock</span>
          <select name="showPicksBeforeLock" defaultValue={stage.showPicksBeforeLock ? "1" : "0"} className={selectClass}>
            <option value="0">Hidden until lock</option>
            <option value="1">Visible to everyone</option>
          </select>
        </label>
        {stage.kind === "playoff" ? (
          <label className="block">
            <span className={labelClass}>Final</span>
            <select name="finalFormat" defaultValue={stage.finalFormat === "bo5" ? "bo5" : "bo3"} className={selectClass}>
              <option value="bo3">Best of 3</option>
              <option value="bo5">Best of 5</option>
            </select>
          </label>
        ) : (
          <input type="hidden" name="finalFormat" value={stage.finalFormat} />
        )}
        <p className="text-xs text-zinc-500">
          {stage.kind === "playoff"
            ? "Assign eight teams and seeds. Quarterfinals are 1 vs 8, 4 vs 5, 2 vs 7, and 3 vs 6."
            : "Stage 2 is eight advancers plus eight invited teams. Stage 3 is the same shape. Opening picks does not add teams."}
        </p>
        <SubmitButton className={btnPrimary}>Save stage</SubmitButton>
      </form>

      <section className="space-y-3" id="teams">
        <div>
          <h2 className="text-xl font-semibold">Teams</h2>
          <p className="mt-1 text-sm text-zinc-400">
            <Link href="/admin/rosters" className="font-semibold text-amber-300">
              Edit roster nicknames and ratings
            </Link>
          </p>
          <p className="mt-1 text-sm text-zinc-400">
            Seed is the opening Swiss seed. VRS is the global rank shown next to the seed. Other rank is the orange badge. Names and logos are shared if the team appears in another stage. Paste an https logo URL, or leave it blank for an initials badge.
          </p>
        </div>
        <div className="space-y-3">
          {bundle.teams.map((team) => (
            <article key={team.stageTeamId} className={`${cardClass} space-y-3 p-3`}>
              <TeamBadge name={team.name} shortName={team.shortName} logoUrl={team.logoUrl} seed={team.seed} compact />
              <input type="hidden" name="stageTeamId" value={team.stageTeamId} form="save-teams" />
              <div className="grid grid-cols-2 gap-2">
                <label className="col-span-2 block">
                  <span className={labelClass}>Name</span>
                  <input name={`name_${team.stageTeamId}`} form="save-teams" defaultValue={team.name} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Short</span>
                  <input name={`short_${team.stageTeamId}`} form="save-teams" defaultValue={team.shortName} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Region</span>
                  <input name={`region_${team.stageTeamId}`} form="save-teams" defaultValue={team.region ?? ""} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Seed</span>
                  <input name={`seed_${team.stageTeamId}`} form="save-teams" defaultValue={team.seed} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>VRS</span>
                  <input name={`world_${team.stageTeamId}`} form="save-teams" defaultValue={team.worldRank ?? ""} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Other</span>
                  <input name={`other_${team.stageTeamId}`} form="save-teams" defaultValue={team.otherRank ?? ""} className={inputClass} />
                </label>
                <div className="col-span-2">
                  <LogoField form="save-teams" name={`logo_${team.stageTeamId}`} defaultValue={team.storedLogoUrl ?? ""} />
                </div>
              </div>
              <ConfirmForm action={removeTeam} message={`Remove ${team.name} from this stage?`}>
                <input type="hidden" name="stageId" value={stage.id} />
                <input type="hidden" name="teamId" value={team.teamId} />
                <button type="submit" className="text-xs text-rose-300">
                  Remove from stage
                </button>
              </ConfirmForm>
            </article>
          ))}
        </div>
        <form id="save-teams" action={saveTeams}>
          <input type="hidden" name="stageId" value={stage.id} />
          <SubmitButton className={btnPrimary}>Save teams</SubmitButton>
        </form>

        <BulkTeamAdd
          stageId={stage.id}
          teams={outside}
          nextSeed={(bundle.teams.reduce((max, team) => Math.max(max, team.seed), 0) || 0) + 1}
        />

        <form action={addTeam} className={`${cardClass} space-y-3 p-4`}>
          <h3 className="font-semibold">Add a new team</h3>
          <input type="hidden" name="stageId" value={stage.id} />
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 block">
              <span className={labelClass}>Name</span>
              <input name="name" required className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Short</span>
              <input name="short" required className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Region</span>
              <input name="region" className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Seed</span>
              <input name="seed" required className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>VRS</span>
              <input name="world" className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Other</span>
              <input name="other" className={inputClass} />
            </label>
            <div className="col-span-2">
              <LogoField name="logo" />
            </div>
          </div>
          <SubmitButton className={btnGhost}>Add team</SubmitButton>
        </form>
      </section>

      <section id="matches" className="space-y-3">
        <h2 className="text-xl font-semibold">Matches</h2>
        {suggestion ? (
          <form action={createSuggestedRound} className={`${cardClass} space-y-3 p-4`}>
            <div>
              <h3 className="font-semibold">Suggested round {nextRound}</h3>
              <p className="mt-1 text-sm text-zinc-400">
                Valve pairing for this round: Buchholz, then initial seed, high against low, with the round 4–5 priority table. Edit anything before creating it.
              </p>
            </div>
            <input type="hidden" name="stageId" value={stage.id} />
            <input type="hidden" name="round" value={nextRound} />
            <input type="hidden" name="count" value={suggestion.length} />
            {suggestion.map((pair, index) => (
              <fieldset key={`${pair.teamAId}-${pair.teamBId}`} className="space-y-2 rounded-xl border border-white/10 p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`include_${index}`} value="1" defaultChecked />
                  Include · {pair.wins}-{pair.losses}
                  {pair.rematch ? " · rematch" : ""}
                </label>
                <TeamSelect name={`teamA_${index}`} teams={bundle.teams} defaultValue={pair.teamAId} />
                <TeamSelect name={`teamB_${index}`} teams={bundle.teams} defaultValue={pair.teamBId} />
                <select name={`format_${index}`} defaultValue={pair.format} className={selectClass}>
                  <option value="bo1">Bo1</option>
                  <option value="bo3">Bo3</option>
                </select>
                <UtcDateTimeField name={`time_${index}`} defaultIso={staggerFrom(suggestStart, index).toISOString()} required />
              </fieldset>
            ))}
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" name="allowRematch" value="1" defaultChecked={suggestion.some((pair) => pair.rematch)} />
              Allow rematch
            </label>
            <SubmitButton className={btnPrimary}>Create round {nextRound}</SubmitButton>
          </form>
        ) : (
          <p className={`${cardClass} p-4 text-sm text-zinc-400`}>
            {active.length === 0 && bundle.teams.length > 0
              ? "Every team has advanced or been eliminated."
              : latestOpen
                ? "Enter this round's results before suggesting the next one."
                : nextRound > 5
                  ? "Swiss stops after five rounds."
                  : "Add teams before suggesting a round."}
          </p>
        )}

        <form action={addMatch} className={`${cardClass} space-y-3 p-4`}>
          <h3 className="font-semibold">Add one match</h3>
          <input type="hidden" name="stageId" value={stage.id} />
          <label className="block">
            <span className={labelClass}>Round</span>
            <input name="round_0" defaultValue={Math.min(nextRound, 5)} required className={inputClass} />
          </label>
          <TeamSelect name="teamA_0" teams={bundle.teams} />
          <TeamSelect name="teamB_0" teams={bundle.teams} />
          <select name="format_0" defaultValue="bo1" className={selectClass}>
            <option value="bo1">Bo1</option>
            <option value="bo3">Bo3</option>
          </select>
          <label className="block">
            <span className={labelClass}>Start</span>
            <UtcDateTimeField name="time_0" defaultIso={suggestStart.toISOString()} required />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" name="allowRematch" value="1" />
            Allow rematch
          </label>
          <SubmitButton className={btnGhost}>Add match</SubmitButton>
        </form>

        {rounds.map((round) => (
          <div key={round} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-500">Round {round}</h3>
            {bundle.matches
              .filter((match) => match.round === round)
              .map((match) => (
                <article key={match.id} id={`m-${match.id}`} className={`${cardClass} scroll-mt-4 space-y-3 p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {match.teamAShort} vs {match.teamBShort}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {match.format === "bo3" ? "Bo3" : "Bo1"} · <LocalTime iso={match.scheduledAt.toISOString()} />
                      </p>
                    </div>
                    {match.winnerId ? (
                      <p className="text-sm text-emerald-200">
                        {match.scoreA}-{match.scoreB}
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500">No result</p>
                    )}
                  </div>
                  <form action={saveMatchOdds} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                    <input type="hidden" name="matchId" value={match.id} />
                    <label className="block">
                      <span className={labelClass}>{match.teamAShort} odds</span>
                      <input name="oddsA" inputMode="decimal" defaultValue={oddsByMatch.get(match.id)?.oddsA ?? ""} placeholder="1.44" className={inputClass} />
                    </label>
                    <label className="block">
                      <span className={labelClass}>{match.teamBShort} odds</span>
                      <input name="oddsB" inputMode="decimal" defaultValue={oddsByMatch.get(match.id)?.oddsB ?? ""} placeholder="2.90" className={inputClass} />
                    </label>
                    <SubmitButton className={btnGhost}>Save odds</SubmitButton>
                  </form>
                  <p className="text-[11px] text-zinc-500">A saved price overrides the feed. Clear both boxes to use the feed again. Odds do not affect scoring.</p>
                  <ResultPad match={match} />
                  <details>
                    <summary className="cursor-pointer text-sm text-zinc-400">Edit match</summary>
                    <form action={updateMatch} className="mt-3 space-y-2">
                      <input type="hidden" name="matchId" value={match.id} />
                      <input name="round" defaultValue={match.round} className={inputClass} />
                      <TeamSelect name="teamAId" teams={bundle.teams} defaultValue={match.teamAId} />
                      <TeamSelect name="teamBId" teams={bundle.teams} defaultValue={match.teamBId} />
                      <select name="format" defaultValue={match.format} className={selectClass}>
                        <option value="bo1">Bo1</option>
                        <option value="bo3">Bo3</option>
                      </select>
                      <UtcDateTimeField name="scheduledAt" defaultIso={match.scheduledAt.toISOString()} required />
                      <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input type="checkbox" name="allowRematch" value="1" />
                        Allow rematch
                      </label>
                      <SubmitButton className={btnGhost}>Update match</SubmitButton>
                    </form>
                    <ConfirmForm action={deleteMatch} message="Delete this match and every pick on it?" className="mt-3">
                      <input type="hidden" name="matchId" value={match.id} />
                      <button type="submit" className={btnDanger}>
                        Delete match
                      </button>
                    </ConfirmForm>
                  </details>
                </article>
              ))}
          </div>
        ))}
      </section>
    </div>
  );
}

function TeamSelect({
  name,
  teams,
  defaultValue,
}: {
  name: string;
  teams: StageTeamView[];
  defaultValue?: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue} required className={selectClass}>
      {teams.map((team) => (
        <option key={team.teamId} value={team.teamId}>
          {team.seed}. {team.shortName}
        </option>
      ))}
    </select>
  );
}

function ResultPad({
  match,
}: {
  match: {
    id: string;
    format: "bo1" | "bo3";
    teamAId: string;
    teamBId: string;
    teamAShort: string;
    teamBShort: string;
    winnerId: string | null;
    scoreA: number | null;
    scoreB: number | null;
  };
}) {
  const currentMargin = match.format === "bo3" ? marginOf(match.scoreA, match.scoreB) : null;
  const options =
    match.format === "bo3"
      ? [
          { winnerId: match.teamAId, margin: "2-0" as const, label: `${match.teamAShort} 2-0` },
          { winnerId: match.teamAId, margin: "2-1" as const, label: `${match.teamAShort} 2-1` },
          { winnerId: match.teamBId, margin: "2-0" as const, label: `${match.teamBShort} 2-0` },
          { winnerId: match.teamBId, margin: "2-1" as const, label: `${match.teamBShort} 2-1` },
        ]
      : [
          { winnerId: match.teamAId, margin: null, label: `${match.teamAShort} wins` },
          { winnerId: match.teamBId, margin: null, label: `${match.teamBShort} wins` },
        ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = match.winnerId === option.winnerId && (option.margin == null || option.margin === currentMargin);
        return (
          <form key={option.label} action={setResult}>
            <input type="hidden" name="matchId" value={match.id} />
            <input type="hidden" name="winnerId" value={option.winnerId} />
            {option.margin ? <input type="hidden" name="margin" value={option.margin} /> : null}
            <button
              type="submit"
              className={
                active
                  ? "rounded-lg border border-emerald-400/70 bg-emerald-400/20 px-2.5 py-1.5 text-xs font-semibold text-emerald-100"
                  : "rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-white/10"
              }
            >
              {option.label}
            </button>
          </form>
        );
      })}
      {match.winnerId ? (
        <form action={setResult}>
          <input type="hidden" name="matchId" value={match.id} />
          <input type="hidden" name="winnerId" value="" />
          <button type="submit" className="rounded-lg border border-rose-400/40 px-2.5 py-1.5 text-xs font-semibold text-rose-200">
            Undo
          </button>
        </form>
      ) : null}
    </div>
  );
}

function marginOf(scoreA: number | null, scoreB: number | null): "2-0" | "2-1" {
  if (scoreA == null || scoreB == null) return "2-0";
  return Math.min(scoreA, scoreB) === 0 ? "2-0" : "2-1";
}
