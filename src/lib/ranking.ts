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
 * Sort by total points only. Equal totals share a rank and the next rank skips
 * (1, 1, 3). Display name only stabilises the order inside a tie.
 */
export function rankRows(rows: ScoreInput[]): RankedScore[] {
  const sorted = rows
    .map((row) => ({ ...row, total: totalPoints(row) }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    });

  const ranked: RankedScore[] = [];
  let index = 0;
  while (index < sorted.length) {
    let end = index;
    while (end + 1 < sorted.length && sorted[end + 1].total === sorted[index].total) {
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

export function formatRank(rank: number): string {
  return String(rank);
}
