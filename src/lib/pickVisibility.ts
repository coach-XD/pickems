export function canViewPicks(input: {
  isOwner: boolean;
  isAdmin: boolean;
  slateLocked: boolean;
  showBeforeLock: boolean;
}): boolean {
  if (input.isOwner || input.isAdmin) return true;
  return input.slateLocked || input.showBeforeLock;
}

export function bracketStatus(winnerCount: number, matchCount: number): "empty" | "partial" | "complete" {
  if (matchCount === 0 || winnerCount === 0) return "empty";
  if (winnerCount >= matchCount) return "complete";
  return "partial";
}
