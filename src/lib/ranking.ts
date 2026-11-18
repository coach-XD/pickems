export type ScoreInput = {
  playerId: string;
  name: string;
  matchPoints: number;
  mapPoints: number;
  placementPoints: number;
  correctPlacements: number;
};

export type RankedScore = ScoreInput & {
  total: number;
  rank: number;
  tied: boolean;
};

export function totalPoints(row: Pick<ScoreInput, "matchPoints" | "mapPoints" | "placementPoints">): number {
  return row.matchPoints + row.mapPoints + row.placementPoints;
}

/**
 * Sort by total points, then by correct placement picks.
 * Equal on both share a rank (competition ranking: 1, T-2, T-2, 4).
 * Display name only stabilises the order inside a tie. It is not a tiebreak.
 */
export function rankRows(rows: ScoreInput[]): RankedScore[] {
  const sorted = rows
    .map((row) => ({ ...row, total: totalPoints(row) }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.correctPlacements !== a.correctPlacements) return b.correctPlacements - a.correctPlacements;
      return a.name.localeCompare(b.name);
    });

  const ranked: RankedScore[] = [];
  let index = 0;
  while (index < sorted.length) {
    let end = index;
    while (
      end + 1 < sorted.length &&
      sorted[end + 1].total === sorted[index].total &&
      sorted[end + 1].correctPlacements === sorted[index].correctPlacements
    ) {
      end += 1;
    }
    const tied = end > index;
    const rank = index + 1;
    for (let cursor = index; cursor <= end; cursor += 1) {
      ranked.push({ ...sorted[cursor], rank, tied });
    }
    index = end + 1;
  }
  return ranked;
}

export function formatRank(rank: number, tied: boolean): string {
  return tied ? `T-${rank}` : String(rank);
}
