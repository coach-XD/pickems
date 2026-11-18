/**
 * Placeholder playoff points. Change these before the stage is opened.
 * Swiss stage weights stay in the scoring module: 1 / +1 / 5 / 2.
 */
export const PLAYOFF_SCORING = {
  quarterfinal: 2,
  semifinal: 3,
  champion: 5,
} as const;

export function playoffPointsForRound(round: number): number {
  if (round === 1) return PLAYOFF_SCORING.quarterfinal;
  if (round === 2) return PLAYOFF_SCORING.semifinal;
  if (round === 3) return PLAYOFF_SCORING.champion;
  return 0;
}
