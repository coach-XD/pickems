import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "./index";
import { bracketPicks, matches, players, stages, stageTeams, teams } from "./schema";
import { autoPlay } from "@/lib/bracket";
import { hashPin, nameKey } from "@/lib/secrets";
import { pairNextRound } from "@/lib/valveSwiss";

const url = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(url)) {
  console.error("Refusing to write preview results outside localhost.");
  process.exit(1);
}

const PEOPLE = [
  { name: "Sam", pin: "1111", style: "favorite" as const },
  { name: "Riley", pin: "2222", style: "underdog" as const },
  { name: "Alex", pin: "3333", style: "mixed" as const },
];

async function main() {
  const db = getDb();
  const [stage] = await db.select().from(stages).where(eq(stages.slug, "stage-1")).limit(1);
  if (!stage) throw new Error("Stage 1 is not seeded.");
  const enrolled = await db
    .select({ teamId: stageTeams.teamId, seed: stageTeams.seed, name: teams.name })
    .from(stageTeams)
    .innerJoin(teams, eq(teams.id, stageTeams.teamId))
    .where(eq(stageTeams.stageId, stage.id));
  const roster = enrolled.map((team) => ({ teamId: team.teamId, seed: team.seed }));
  let flip = false;
  const boards = {
    favorite: autoPlay({
      teams: roster,
      choose: (match) => ({ winnerId: match.teamAId, margin: match.format === "bo3" ? "2-0" : null }),
    }),
    underdog: autoPlay({
      teams: roster,
      choose: (match) => ({ winnerId: match.teamBId, margin: match.format === "bo3" ? "2-1" : null }),
    }),
    mixed: autoPlay({
      teams: roster,
      choose: (match) => {
        flip = !flip;
        return { winnerId: flip ? match.teamAId : match.teamBId, margin: match.format === "bo3" ? "2-1" : null };
      },
    }),
  };

  for (const person of PEOPLE) {
    const key = nameKey(person.name);
    const [existing] = await db.select().from(players).where(eq(players.displayNameKey, key)).limit(1);
    const player =
      existing ??
      (
        await db
          .insert(players)
          .values({ displayName: person.name, displayNameKey: key, pinHash: await hashPin(person.pin), isDemo: false })
          .returning()
      )[0];
    await db
      .insert(bracketPicks)
      .values({ playerId: player.id, stageId: stage.id, picks: boards[person.style] })
      .onConflictDoUpdate({
        target: [bracketPicks.playerId, bracketPicks.stageId],
        set: { picks: boards[person.style], updatedAt: new Date() },
      });
    console.log(`${person.name} bracket saved (${boards[person.style].length} picks).`);
  }

  const round1 = await db.select().from(matches).where(and(eq(matches.stageId, stage.id), eq(matches.round, 1)));
  const seedOf = new Map(enrolled.map((team) => [team.teamId, team.seed]));
  const ordered = round1.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  for (const [index, match] of ordered.entries()) {
    const betterA = (seedOf.get(match.teamAId) ?? 99) <= (seedOf.get(match.teamBId) ?? 99);
    const winnerId = betterA ? match.teamAId : match.teamBId;
    await db
      .update(matches)
      .set({
        winnerId,
        scoreA: winnerId === match.teamAId ? 1 : 0,
        scoreB: winnerId === match.teamBId ? 1 : 0,
        resultAt: new Date(Date.UTC(2026, 10, 24, 12, index, 0)),
      })
      .where(eq(matches.id, match.id));
  }
  console.log(`Saved ${ordered.length} Round 1 results.`);

  const played = await db.select().from(matches).where(eq(matches.stageId, stage.id));
  for (const round of [2, 3]) {
    if (played.some((match) => match.round === round)) {
      console.log(`Round ${round} already exists. Leaving it.`);
      continue;
    }
    const pairs = pairNextRound({
      teams: roster,
      completed: played
        .filter((match) => match.winnerId && match.round < round)
        .map((match) => ({ round: match.round, teamAId: match.teamAId, teamBId: match.teamBId, winnerId: match.winnerId! })),
      round,
    });
    if (pairs.length === 0) break;
    const start = new Date(Date.UTC(2026, 10, 24 + round, 4, 0, 0));
    for (const [index, pair] of pairs.entries()) {
      const [created] = await db
        .insert(matches)
        .values({
          stageId: stage.id,
          round,
          teamAId: pair.teamAId,
          teamBId: pair.teamBId,
          format: pair.format,
          scheduledAt: new Date(start.getTime() + index * 60 * 60 * 1000),
        })
        .returning();
      played.push(created);
      if (round === 2) {
        const betterA = (seedOf.get(pair.teamAId) ?? 99) <= (seedOf.get(pair.teamBId) ?? 99);
        const winnerId = betterA ? pair.teamAId : pair.teamBId;
        await db
          .update(matches)
          .set({
            winnerId,
            scoreA: winnerId === pair.teamAId ? 1 : 0,
            scoreB: winnerId === pair.teamBId ? 1 : 0,
            resultAt: new Date(Date.UTC(2026, 10, 24, 13, index, 0)),
          })
          .where(eq(matches.id, created.id));
        created.winnerId = winnerId;
      }
    }
    console.log(`Round ${round}: ${pairs.length} matches${round === 3 ? ", left pending" : ", resulted"}.`);
  }

  const bo3 = played.find((match) => match.round === 3 && match.format === "bo3");
  if (bo3) {
    const betterA = (seedOf.get(bo3.teamAId) ?? 99) <= (seedOf.get(bo3.teamBId) ?? 99);
    const winnerId = betterA ? bo3.teamAId : bo3.teamBId;
    await db
      .update(matches)
      .set({
        winnerId,
        scoreA: winnerId === bo3.teamAId ? 2 : 0,
        scoreB: winnerId === bo3.teamBId ? 2 : 0,
        resultAt: new Date(Date.UTC(2026, 10, 24, 14, 0, 0)),
      })
      .where(eq(matches.id, bo3.id));
    console.log("Saved one Round 3 Bo3 as 2-0 so the latest result can pay the exact-score point.");
  }
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
