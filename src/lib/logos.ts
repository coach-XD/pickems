/**
 * Built-in marks live in /public/logos. An admin logo URL wins when it is set.
 * Files sourced from Wikimedia are noted below. The rest are original monograms
 * because no reusable logo file could be found.
 */
export const TEAM_LOGOS: Record<string, string> = {
  "Ninjas in Pyjamas": "/logos/nip.svg",
  PARIVISION: "/logos/parivision.svg",
  HEROIC: "/logos/heroic.png",
  FaZe: "/logos/faze.svg",
  Liquid: "/logos/liquid.svg",
  "Eternal Fire": "/logos/eternal-fire.svg",
  "100 Thieves": "/logos/100t.svg",
  "9z": "/logos/9z.svg",
  M80: "/logos/m80.svg",
  DENDELE: "/logos/dendele.svg",
  Imperial: "/logos/imperial.png",
  Wildcard: "/logos/wildcard.svg",
  "BC.Game": "/logos/bc-game.svg",
  FlyQuest: "/logos/flyquest.svg",
  "Chinggis Warriors": "/logos/chinggis.svg",
  "Lynn Vision": "/logos/lynn-vision.svg",
};

/** Teams with an original monogram instead of a sourced logo. */
export const MISSING_OFFICIAL_LOGOS = [
  "PARIVISION",
  "Eternal Fire",
  "M80",
  "DENDELE",
  "Wildcard",
  "BC.Game",
  "Chinggis Warriors",
  "Lynn Vision",
] as const;

export function resolveLogo(team: { name: string; logoUrl?: string | null }): string | null {
  if (team.logoUrl) return team.logoUrl;
  return TEAM_LOGOS[team.name] ?? null;
}
