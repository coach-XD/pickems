import "dotenv/config";
import { eq } from "drizzle-orm";
import { buildSampleBoard, DEMO_PIN, DEMO_SLUG } from "@/lib/demo";
import { hashPin, nameKey } from "@/lib/secrets";
import { closeDb, getDb } from "./index";
import { matchPicks, matches, placementPicks, players, stageTeams, stages, teams } from "./schema";
import { STAGE1_TEAMS } from "./stage1";

async function main() {
  const db = getDb();
  const [existing] = await db.select({ id: stages.id }).from(stages).where(eq(stages.slug, DEMO_SLUG)).limit(1);
  if (existing) {
    console.log("Sample stage already exists. Skipping.");
    return;
  }

  const catalog = await db.select().from(teams);
  const byName = new Map(catalog.map((team) => [team.name, team]));
  const missing = STAGE1_TEAMS.filter((team) => !byName.has(team.name));
  if (missing.length) {
    throw new Error("Run npm run db:seed before the sample seed. Missing teams: " + missing.map((team) => team.name).join(", "));
  }

  const sampleTeams = STAGE1_TEAMS.map((team) => ({
    teamId: byName.get(team.name)!.id,
    seed: team.seed,
    name: team.name,
  }));
  const board = buildSampleBoard(sampleTeams);
  const pinHash = await hashPin(DEMO_PIN);

  await db.transaction(async (tx) => {
    const [stage] = await tx
      .insert(stages)
      .values({
        slug: DEMO_SLUG,
        name: "Sample stage",
        startsAt: new Date("2026-11-01T04:00:00.000Z"),
        endsAt: new Date("2026-11-04T16:00:00.000Z"),
        sortOrder: 50,
        isDemo: true,
      })
      .returning();

    await tx.insert(stageTeams).values(
      sampleTeams.map((team) => {
        const source = STAGE1_TEAMS.find((row) => row.seed === team.seed)!;
        return {
          stageId: stage.id,
          teamId: team.teamId,
          seed: team.seed,
          worldRank: source.worldRank,
          otherRank: source.otherRank,
        };
      }),
    );

    const rounds = new Map<number, number>();
    const inserted: Array<{ id: string; round: number; teamAId: string; teamBId: string }> = [];
    for (const match of board.matches) {
      const index = rounds.get(match.round) ?? 0;
      rounds.set(match.round, index + 1);
      const day = new Date(Date.UTC(2026, 10, 1 + (match.round - 1), 4 + Math.floor(index / 2), 0, 0));
      const [row] = await tx
        .insert(matches)
        .values({
          stageId: stage.id,
          round: match.round,
          teamAId: match.teamAId,
          teamBId: match.teamBId,
          format: match.format,
          scheduledAt: day,
          winnerId: match.winnerId,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
        })
        .returning();
      inserted.push(row);
    }

    for (const player of board.players) {
      const key = nameKey(player.name);
      const [taken] = await tx.select({ id: players.id }).from(players).where(eq(players.displayNameKey, key)).limit(1);
      if (taken) {
        console.log(`Skipping sample player ${player.name}; that name is already taken.`);
        continue;
      }
      const [created] = await tx
        .insert(players)
        .values({
          displayName: player.name,
          displayNameKey: key,
          pinHash,
          isDemo: true,
        })
        .returning();

      if (player.placements.length) {
        await tx.insert(placementPicks).values(
          player.placements.map((pick) => ({
            playerId: created.id,
            stageId: stage.id,
            teamId: pick.teamId,
            slot: pick.slot,
          })),
        );
      }

      const pickRows = player.picks.flatMap((pick) => {
        const match = inserted.find(
          (row) => row.round === pick.round && row.teamAId === pick.teamAId && row.teamBId === pick.teamBId,
        );
        if (!match) return [];
        return [
          {
            playerId: created.id,
            matchId: match.id,
            winnerId: pick.winnerId,
            scoreA: pick.scoreA,
            scoreB: pick.scoreB,
          },
        ];
      });
      if (pickRows.length) await tx.insert(matchPicks).values(pickRows);
    }
  });

  console.log(`Seeded the sample stage and 8 players. PIN for every sample player is ${DEMO_PIN}.`);
  console.log("The sample stage stays hidden until someone turns on “Show sample stage”.");
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
