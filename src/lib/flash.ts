export const FLASH: Record<string, string> = {
  pin: "That PIN doesn't match this name.",
  join: "Use a name of 2–20 characters and a 4–8 digit PIN.",
  invite: "This invite link isn't valid.",
  "invite-missing": "The host still needs to set INVITE_TOKEN.",
  locked: "That pick is already locked.",
  slate: "Pick 2 teams to go 3-0, 2 to go 0-3, and 6 more to advance. No team twice.",
  saved: "Saved.",
  "admin-auth": "Wrong password.",
  "admin-missing": "Set ADMIN_PASSWORD before signing in.",
  rematch: "Those teams already meet in this stage. Tick “Allow rematch” to override.",
  "match-teams": "Pick two different teams from this stage.",
  "match-result": "Bo3 results need a winner and a 2-0 or 2-1 score.",
  "seed-dup": "Two teams can't share a seed.",
  "seed-range": "Seeds are whole numbers from 1 to 32.",
  "team-name": "That team name is already used.",
  "team-fields": "Check the team name, short name, and logo URL.",
  "team-used": "Delete this team's matches in the stage before removing them.",
  "team-missing": "That team isn't in this stage.",
  round: "Rounds are numbered 1 to 5.",
  removed: "Player removed.",
  created: "Created.",
  deleted: "Deleted.",
  "demo-player": "Sample players can only pick on the sample stage.",
  "stage-name": "Give the stage a name.",
  "stage-time": "Enter a valid start time.",
  "match-time": "Enter a valid match time.",
  "not-found": "That could not be found.",
  "roster-fields": "Check the nicknames and ratings. A rating can be blank or a number with up to two decimals.",
  "team-in": "That team is already in this stage.",
};

export function flashMessage(code: string | undefined): string | null {
  if (!code) return null;
  return FLASH[code] ?? "Something went wrong.";
}
