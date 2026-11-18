export type FutureStageSeed = {
  slug: string;
  name: string;
  kind: "swiss" | "playoff";
  picksOpen: boolean;
  finalFormat: "bo3" | "bo5";
  sortOrder: number;
  startsAt: string;
  endsAt: string;
};

/** No teams. Picks stay closed until an admin opens the stage. */
export const FUTURE_STAGES: FutureStageSeed[] = [
  {
    slug: "stage-2",
    name: "Stage 2",
    kind: "swiss",
    picksOpen: false,
    finalFormat: "bo3",
    sortOrder: 2,
    startsAt: "2026-11-28T04:00:00.000Z",
    endsAt: "2026-12-01T16:00:00.000Z",
  },
  {
    slug: "stage-3",
    name: "Stage 3",
    kind: "swiss",
    picksOpen: false,
    finalFormat: "bo3",
    sortOrder: 3,
    startsAt: "2026-12-02T04:00:00.000Z",
    endsAt: "2026-12-05T16:00:00.000Z",
  },
  {
    slug: "playoffs",
    name: "Playoffs",
    kind: "playoff",
    picksOpen: false,
    finalFormat: "bo3",
    sortOrder: 4,
    startsAt: "2026-12-08T04:00:00.000Z",
    endsAt: "2026-12-13T16:00:00.000Z",
  },
];
