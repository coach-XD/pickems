/**
 * Built-in marks live in /public/logos. An admin logo URL wins when it is set.
 * FlyQuest stays on the existing SVG. The other files are the trimmed 256px PNGs.
 */
export const TEAM_LOGOS: Record<string, string> = {
  "Ninjas in Pyjamas": "/logos/nip.png",
  PARIVISION: "/logos/parivision.png",
  HEROIC: "/logos/heroic.png",
  FaZe: "/logos/faze.png",
  Liquid: "/logos/liquid.png",
  "Eternal Fire": "/logos/eternal-fire.png",
  "100 Thieves": "/logos/100t.png",
  "9z": "/logos/9z.png",
  M80: "/logos/m80.png",
  DENDELE: "/logos/dendele.png",
  Imperial: "/logos/imperial.png",
  Wildcard: "/logos/wildcard.png",
  "BC.Game": "/logos/bc-game.png",
  FlyQuest: "/logos/flyquest.svg",
  "Chinggis Warriors": "/logos/chinggis.png",
  "Lynn Vision": "/logos/lynn-vision.png",
};

export function resolveLogo(team: { name: string; logoUrl?: string | null }): string | null {
  if (team.logoUrl) return team.logoUrl;
  return TEAM_LOGOS[team.name] ?? null;
}

/** Demo stages and sample players stay off production unless SHOW_DEMO=1. */
export function allowDemoData(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO === "1";
}
