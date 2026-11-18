import "dotenv/config";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "./index";
import { matches, stageTeams, stages, teams } from "./schema";
import { STAGE1_END, STAGE1_MATCHES, STAGE1_SLUG, STAGE1_START, STAGE1_TEAMS } from "./stage1";

async function main() {
  const db = getDb();
  const [existing] = await db.select({ id: stages.id }).from(stages).where(eq(stages.slug, STAGE1_SLUG)).limit(1);
  if (existing) {
    console.log("Stage 1 already exists. Leaving teams, seeds, and matches alone.");
    return;
  }

  await db.transaction(async (tx) => {
    const teamIdBySeed = new Map<number, string>();
    for (const team of STAGE1_TEAMS) {
      const [found] = await tx.select().from(teams).where(eq(teams.name, team.name)).limit(1);
      if (found) {
        teamIdBySeed.set(team.seed, found.id);
        continue;
      }
      const [created] = await tx
        .insert(teams)
        .values({
          name: team.name,
          shortName: team.shortName,
          region: team.region,
        })
        .returning();
      teamIdBySeed.set(team.seed, created.id);
    }

    const [stage] = await tx
      .insert(stages)
      .values({
        slug: STAGE1_SLUG,
        name: "Stage 1",
        startsAt: new Date(STAGE1_START),
        endsAt: new Date(STAGE1_END),
        sortOrder: 1,
        isDemo: false,
      })
      .returning();

    await tx.insert(stageTeams).values(
      STAGE1_TEAMS.map((team) => ({
        stageId: stage.id,
        teamId: teamIdBySeed.get(team.seed)!,
        seed: team.seed,
        worldRank: team.worldRank,
        otherRank: team.otherRank,
      })),
    );

    await tx.insert(matches).values(
      STAGE1_MATCHES.map((match) => ({
        stageId: stage.id,
        round: match.round,
        teamAId: teamIdBySeed.get(match.seedA)!,
        teamBId: teamIdBySeed.get(match.seedB)!,
        format: match.format,
        scheduledAt: new Date(match.scheduledAt),
      })),
    );
  });

  console.log("Seeded Stage 1: 16 teams and 8 Round 1 Bo1s. No results.");
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
