import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "./index";
import { STAGE1_SLUG, STAGE1_TEAMS } from "./stage1";
import { stageTeams, stages, teams } from "./schema";

const LEGACY_NAMES: Record<string, string[]> = {
  "BC.Game (GOSH)": ["BC.Game"],
};

async function main() {
  const db = getDb();
  const [stage] = await db.select({ id: stages.id }).from(stages).where(eq(stages.slug, STAGE1_SLUG)).limit(1);
  if (!stage) {
    console.log("Stage 1 is not in this database. Nothing updated.");
    return;
  }

  for (const team of STAGE1_TEAMS) {
    const names = [team.name, ...(LEGACY_NAMES[team.name] ?? [])];
    let row: { stageTeamId: string; worldRank: number | null; vrsPoints: number | null; foundName: string } | undefined;
    for (const name of names) {
      const [found] = await db
        .select({
          stageTeamId: stageTeams.id,
          worldRank: stageTeams.worldRank,
          vrsPoints: stageTeams.vrsPoints,
          foundName: teams.name,
        })
        .from(stageTeams)
        .innerJoin(teams, eq(teams.id, stageTeams.teamId))
        .where(and(eq(stageTeams.stageId, stage.id), eq(teams.name, name)))
        .limit(1);
      if (found) {
        row = found;
        break;
      }
    }
    if (!row) {
      console.log(`${team.name}: not on Stage 1, skipped.`);
      continue;
    }
    if (row.worldRank === team.worldRank && row.vrsPoints === team.vrsPoints) {
      console.log(`${row.foundName}: VRS #${team.worldRank} and ${team.vrsPoints} points already set.`);
      continue;
    }
    await db
      .update(stageTeams)
      .set({ worldRank: team.worldRank, vrsPoints: team.vrsPoints })
      .where(eq(stageTeams.id, row.stageTeamId));
    console.log(
      `${row.foundName}: rank ${row.worldRank ?? "blank"} -> #${team.worldRank}, points ${row.vrsPoints ?? "blank"} -> ${team.vrsPoints}.`,
    );
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
