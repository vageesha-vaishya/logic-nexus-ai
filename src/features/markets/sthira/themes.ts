/**
 * Sthira theme registry — the 4 user-pickable palettes.
 *
 * Adding a theme: append an entry here, add the matching
 * :root[data-sthira-theme="<id>"] block in src/index.css.
 *
 * Swatches are inline hex (not tokens) so the picker preview renders
 * the same on every theme — picking Ocean shouldn't recolor the
 * preview swatches of the other themes.
 */

export type SthiraThemeId = "classic" | "midnight" | "ocean" | "forest";

export interface SthiraThemeMeta {
  id:          SthiraThemeId;
  name:        string;
  description: string;
  swatches:    {
    background: string;   // dominant page surface
    accent:     string;   // primary action / link color
    ink:        string;   // body text on the background
  };
}

export const STHIRA_THEMES: ReadonlyArray<SthiraThemeMeta> = [
  {
    id:   "classic",
    name: "Classic",
    description: "Cream and copper — the original Sthira look.",
    swatches: { background: "#F7F3EB", accent: "#B07645", ink: "#2C2C2C" },
  },
  {
    id:   "midnight",
    name: "Midnight",
    description: "Dark surface with copper accents — easier on the eyes at night.",
    swatches: { background: "#17223A", accent: "#C68A5A", ink: "#F7F3EB" },
  },
  {
    id:   "ocean",
    name: "Ocean",
    description: "Pearl background with royal-blue accents.",
    swatches: { background: "#F0F4FA", accent: "#2C5AA6", ink: "#1A2638" },
  },
  {
    id:   "forest",
    name: "Forest",
    description: "Warm sand with sage-green accents.",
    swatches: { background: "#F5F1E8", accent: "#4A6B47", ink: "#1F2A1F" },
  },
];

export const DEFAULT_STHIRA_THEME: SthiraThemeId = "classic";

export function isSthiraThemeId(value: unknown): value is SthiraThemeId {
  return typeof value === "string" && STHIRA_THEMES.some((t) => t.id === value);
}

export function getSthiraThemeMeta(id: SthiraThemeId): SthiraThemeMeta {
  return STHIRA_THEMES.find((t) => t.id === id) ?? STHIRA_THEMES[0];
}
