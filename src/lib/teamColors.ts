/**
 * Team color helpers (story 7.4) — one source of truth for the hex
 * parsing and the choices offered by the Équipement modal.
 */

/** Parse a #rrggbb hex string into a pixi color; anything else falls back */
export const hexToTeamColor = (
  hex: string | null | undefined,
  fallback: number
): number => {
  if (!hex) return fallback;
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match?.[1]) return fallback;
  return Number.parseInt(match[1], 16);
};

/** API default hexes (mirror the engine's PLAYER_HOME/AWAY_COLOR constants) */
export const PLAYER_HOME_HEX = '#ff6b1a';
export const PLAYER_AWAY_HEX = '#1a8cff';

/** Swatch palette offered by the Équipement modal (mockup v4) */
export const TEAM_COLOR_SWATCHES = [
  '#e4573f',
  '#4aa8e8',
  '#31c48d',
  '#ffc244',
  '#9b6ce8',
  '#12241b',
] as const;

/** Crest whitelist rendered by the modal and enforced server-side */
export const CREST_CHOICES = ['⚽', '🦊', '🐺', '🦁', '🐸', '🚀', '🐙', '🔥', '👑', '🍕'] as const;

// ---------------------------------------------------------------------------
// Away-side readability (story 7.6 feedback): every tactic defaults to
// #ff6b1a and the swatch palette is shared, so two teams can pick the same
// color — the 10 replay players would then be indistinguishable. The away
// side is resolved against home before the match view paints.
// ---------------------------------------------------------------------------

/** Square RGB distance under which two hexes read as "the same color" */
export const AWAY_COLLISION_DISTANCE = 100;

const hexChannel = (hex: string, offset: number): number =>
  Number.parseInt(hex.slice(offset, offset + 2), 16);

/** Euclidean RGB distance between two #rrggbb hexes */
export const teamHexDistance = (a: string, b: string): number => {
  const dr = hexChannel(a, 1) - hexChannel(b, 1);
  const dg = hexChannel(a, 3) - hexChannel(b, 3);
  const db = hexChannel(a, 5) - hexChannel(b, 5);
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

/**
 * The away side must read as the OTHER team. Returns the requested away hex
 * unless it collides with home; the away kit then changes into its OWN
 * secondary (the strip kept for clashes), and the distinct engine default
 * (away blue, then home orange) takes over last. Null/undefined candidates
 * are skipped. Degenerate inputs (identical defaults with an unreachable
 * palette) return the request unchanged.
 */
export const resolveAwayTeamHex = (
  homeHex: string,
  awayHex: string,
  awaySecondaryHex?: string | null
): string => {
  const candidates: (string | null | undefined)[] = [
    awayHex,
    awaySecondaryHex,
    PLAYER_AWAY_HEX,
    PLAYER_HOME_HEX,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (teamHexDistance(homeHex, candidate) >= AWAY_COLLISION_DISTANCE) {
      return candidate;
    }
  }
  return awayHex;
};

/** One side's kit as carried by the API (tactic or match customization) */
export interface SideKit {
  colorPrimary?: string | null;
  colorSecondary?: string | null;
}

/**
 * One source of truth for the match-view kit law (stories 7.4 + 7.6):
 * home always wears its primary, away resolves through resolveAwayTeamHex —
 * its primary unless it reads as home's color, then its OWN secondary, then
 * the engine defaults. Null sides keep today's defaults (practice matches).
 */
export const resolveMatchKits = (
  home?: SideKit | null,
  away?: SideKit | null
): { homeHex: string; awayHex: string } => {
  const homeHex = home?.colorPrimary ?? PLAYER_HOME_HEX;
  const awayHex = resolveAwayTeamHex(
    homeHex,
    away?.colorPrimary ?? PLAYER_AWAY_HEX,
    away?.colorSecondary ?? null
  );
  return { homeHex, awayHex };
};
