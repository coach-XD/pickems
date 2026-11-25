import "dotenv/config";
import { and, eq, inArray, not } from "drizzle-orm";
import { closeDb, getDb } from "./index";
import { FUTURE_STAGES } from "./futureStages";
import { isUniqueViolation } from "@/lib/validators";
import { stageTeams, stages, teamPlayers, teams } from "./schema";
import { STAGE23_TEAMS } from "./stage23";

/** Earlier local draft used this name. Production has neither row. */
const PREVIOUS_NAMES: Record<string, string[]> = {
  "Natus Vincere": ["NAVI"],
};

const STAGE_SLUGS = ["stage-2", "stage-3"] as const;

async function ensureStage(db: ReturnType<typeof getDb>, slug: (typeof STAGE_SLUGS)[number]) {
  const [existing] = await db.select().from(stages).where(eq(stages.slug, slug)).limit(1);
  if (existing) return existing;
  const seed = FUTURE_STAGES.find((stage) => stage.slug === slug);
  if (!seed) throw new Error(`No stage definition for ${slug}.`);
  const [created] = await db
    .insert(stages)
    .values({
      slug: seed.slug,
      name: seed.name,
      startsAt: new Date(seed.startsAt),
      endsAt: new Date(seed.endsAt),
      sortOrder: seed.sortOrder,
      isDemo: false,
      picksOpen: false,
      kind: seed.kind,
      finalFormat: seed.finalFormat,
    })
    .returning();
  console.log(`Created ${seed.name}.`);
  return created;
}

async function main() {
  const db = getDb();
  const stageBySlug = new Map<string, { id: string }>();
  for (const slug of STAGE_SLUGS) stageBySlug.set(slug, await ensureStage(db, slug));

  let teamsWritten = 0;
  let stageRows = 0;
  let playersWritten = 0;

  for (const invite of STAGE23_TEAMS) {
    let existingTeam: typeof teams.$inferSelect | undefined;
    for (const name of [invite.name, ...(PREVIOUS_NAMES[invite.name] ?? [])]) {
      const [found] = await db.select().from(teams).where(eq(teams.name, name)).limit(1);
      if (found) {
        existingTeam = found;
        break;
      }
    }
    const team =
      existingTeam ??
      (
        await db
          .insert(teams)
          .values({
            name: invite.name,
            shortName: invite.shortName,
            region: invite.region,
            logoUrl: null,
            oddspapiId: invite.oddspapiId,
          })
          .returning()
      )[0];
    if (existingTeam) {
      await db
        .update(teams)
        .set({
          name: invite.name,
          shortName: invite.shortName,
          region: invite.region,
          oddspapiId: invite.oddspapiId,
        })
        .where(eq(teams.id, existingTeam.id));
    }
    teamsWritten += 1;

    const stage = stageBySlug.get(invite.stage)!;
    const [enrolled] = await db
      .select()
      .from(stageTeams)
      .where(and(eq(stageTeams.stageId, stage.id), eq(stageTeams.teamId, team.id)))
      .limit(1);
    const values = {
      seed: invite.seed,
      worldRank: invite.worldRank,
      otherRank: invite.otherRank,
      vrsPoints: invite.vrsPoints,
    };
    if (!enrolled) {
      try {
        await db.insert(stageTeams).values({ stageId: stage.id, teamId: team.id, ...values });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        console.log(`${invite.name}: seed ${invite.seed} on ${invite.stage} is already used. Ranks were not moved.`);
      }
    } else {
      try {
        await db.update(stageTeams).set(values).where(eq(stageTeams.id, enrolled.id));
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        await db
          .update(stageTeams)
          .set({ worldRank: values.worldRank, otherRank: values.otherRank, vrsPoints: values.vrsPoints })
          .where(eq(stageTeams.id, enrolled.id));
        console.log(`${invite.name}: kept seed ${enrolled.seed} because ${invite.seed} is taken.`);
      }
    }
    stageRows += 1;

    const nicknames = invite.players.map((player) => player.nickname);
    await db.delete(teamPlayers).where(and(eq(teamPlayers.teamId, team.id), not(inArray(teamPlayers.nickname, nicknames))));
    for (const [index, player] of invite.players.entries()) {
      const [current] = await db
        .select()
        .from(teamPlayers)
        .where(and(eq(teamPlayers.teamId, team.id), eq(teamPlayers.nickname, player.nickname)))
        .limit(1);
      const ratingUpdatedAt = player.rating == null ? null : new Date();
      if (!current) {
        await db.insert(teamPlayers).values({
          teamId: team.id,
          nickname: player.nickname,
          sortOrder: index,
          rating: player.rating,
          ratingUpdatedAt,
        });
        playersWritten += 1;
        continue;
      }
      await db
        .update(teamPlayers)
        .set({ sortOrder: index, rating: player.rating, ratingUpdatedAt })
        .where(eq(teamPlayers.id, current.id));
    }
  }

  console.log(`Stage 2 and Stage 3 invites: ${teamsWritten} teams, ${stageRows} stage rows, ${playersWritten} new players.`);
  console.log("Stage 1 teams, matches, and picks were not changed. logo_url was left empty.");
}

main()
  .then(async () => {
    await closeDb();
  })
  .catch(async (error) => {
    console.error(error);
    await closeDb();
    process.exit(1);
  });
