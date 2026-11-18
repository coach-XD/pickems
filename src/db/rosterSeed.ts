import ratingsJson from "./data/ratings.json";
import rostersJson from "./data/rosters.json";

export type RosterSeedPlayer = {
  teamName: string;
  nickname: string;
  sortOrder: number;
  rating: number | null;
};

export type ExistingRosterPlayer = {
  teamName: string;
  nickname: string;
  sortOrder: number;
  rating: number | null;
};

export type RosterPlan = {
  inserts: RosterSeedPlayer[];
  ratingUpdates: Array<{ teamName: string; nickname: string; rating: number }>;
};

type RosterFile = Array<{ team: string; players: Array<{ nickname: string }> }>;
type RatingFile = Array<{ team: string; nickname: string; rating: number }>;

export const STAGE1_ROSTERS = rostersJson as RosterFile;
export const STAGE1_RATINGS = ratingsJson as RatingFile;

export function rosterPlayersFromFiles(
  rosters: RosterFile = STAGE1_ROSTERS,
  ratings: RatingFile = STAGE1_RATINGS,
): RosterSeedPlayer[] {
  const ratingByKey = new Map(ratings.map((row) => [`${row.team}\0${row.nickname}`, row.rating]));
  return rosters.flatMap((team) =>
    team.players.map((player, index) => ({
      teamName: team.team,
      nickname: player.nickname,
      sortOrder: index,
      rating: ratingByKey.get(`${team.team}\0${player.nickname}`) ?? null,
    })),
  );
}

/**
 * Insert roster rows that are not already stored. Fill a rating only when the
 * stored value is null, so an admin edit is left alone. A renamed row keeps
 * its sort slot and is not duplicated.
 */
export function planRosterSeed(existing: ExistingRosterPlayer[], wanted: RosterSeedPlayer[]): RosterPlan {
  const byName = new Map(existing.map((row) => [`${row.teamName}\0${row.nickname}`, row]));
  const slots = new Set(existing.map((row) => `${row.teamName}\0${row.sortOrder}`));
  const inserts: RosterSeedPlayer[] = [];
  const ratingUpdates: RosterPlan["ratingUpdates"] = [];

  for (const player of wanted) {
    const current = byName.get(`${player.teamName}\0${player.nickname}`);
    if (current) {
      if (current.rating == null && player.rating != null) {
        ratingUpdates.push({ teamName: player.teamName, nickname: player.nickname, rating: player.rating });
      }
      continue;
    }
    if (slots.has(`${player.teamName}\0${player.sortOrder}`)) continue;
    inserts.push(player);
    slots.add(`${player.teamName}\0${player.sortOrder}`);
  }

  return { inserts, ratingUpdates };
}
