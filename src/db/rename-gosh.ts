import "dotenv/config";
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "./index";
import { teams } from "./schema";

const FROM = "BC.Game";
const TO = "BC.Game (GOSH)";

async function main() {
  const db = getDb();
  const [already] = await db.select({ id: teams.id }).from(teams).where(eq(teams.name, TO)).limit(1);
  if (already) {
    console.log(`${TO} is already the stored name. Seeds, matches, and picks were not changed.`);
    return;
  }
  const [current] = await db.select({ id: teams.id }).from(teams).where(eq(teams.name, FROM)).limit(1);
  if (!current) {
    console.log(`No team named ${FROM}. Nothing updated.`);
    return;
  }
  await db.update(teams).set({ name: TO }).where(eq(teams.id, current.id));
  console.log(`Renamed ${FROM} -> ${TO}. Seeds, matches, and picks were not changed.`);
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
