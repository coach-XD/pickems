import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "./index";
import { STAGE1_SLUG, STAGE1_TEAMS } from "./stage1";
import { stageTeams, stages, teams } from "./schema";

async function main() {
  const db = getDb();
  const [stage] = await db.select({ id: stages.id }).from(stages).where(eq(stages.slug, STAGE1_SLUG)).limit(1);
  if (!stage) {
    console.log("Stage 1 is not in this database. Nothing updated.");
    return;
  }

  for (const team of STAGE1_TEAMS) {
    const [row] = await db
      .select({ stageTeamId: stageTeams.id, worldRank: stageTeams.worldRank })
      .from(stageTeams)
      .innerJoin(teams, eq(teams.id, stageTeams.teamId))
      .where(and(eq(stageTeams.stageId, stage.id), eq(teams.name, team.name)))
      .limit(1);
    if (!row) {
      console.log(`${team.name}: not on Stage 1, skipped.`);
      continue;
    }
    if (row.worldRank === team.worldRank) {
      console.log(`${team.name}: VRS #${team.worldRank} already set.`);
      continue;
    }
    await db.update(stageTeams).set({ worldRank: team.worldRank }).where(eq(stageTeams.id, row.stageTeamId));
    console.log(`${team.name}: VRS #${row.worldRank ?? "blank"} -> #${team.worldRank}.`);
  }
  console.log("Seeds, matches, and picks were not changed.");
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
