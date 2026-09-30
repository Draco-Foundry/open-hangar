// Design options (see styles/themes.css). The choice lives in the `oh_theme`
// cookie as "palette.font.style.backdrop" so pages render in it on the server.
export const PALETTES = [
  // Open Hangar's own
  {
    id: 'hangar',
    label: 'Hangar Blue',
    group: 'Open Hangar',
    swatch: ['#0d1117', '#161b22', '#2f81f7'],
  },
  {
    id: 'steel',
    label: 'Foundry Steel',
    group: 'Open Hangar',
    swatch: ['#0a0e14', '#121821', '#1ea7ff'],
  },
  {
    id: 'quantum',
    label: 'Quantum Teal',
    group: 'Open Hangar',
    swatch: ['#060b16', '#0c1526', '#14d3c3'],
  },
  { id: 'amber', label: 'Amber', group: 'Open Hangar', swatch: ['#0f0e0c', '#1a1815', '#f0a020'] },
  { id: 'rust', label: 'Rust', group: 'Open Hangar', swatch: ['#100b0a', '#1b1311', '#e5533d'] },
  {
    id: 'nebula',
    label: 'Nebula',
    group: 'Open Hangar',
    swatch: ['#0b0a12', '#14121f', '#8b5cf6'],
  },
  // Manufacturer-inspired (colours only, not official)
  { id: 'rsi', label: 'RSI', group: 'Manufacturers', swatch: ['#070b14', '#0e1524', '#3d8bff'] },
  {
    id: 'origin',
    label: 'Origin',
    group: 'Manufacturers',
    swatch: ['#f6f5f2', '#ffffff', '#b08a3e'],
  },
  {
    id: 'crusader',
    label: 'Crusader',
    group: 'Manufacturers',
    swatch: ['#f3f7fb', '#ffffff', '#1e88e5'],
  },
  { id: 'misc', label: 'MISC', group: 'Manufacturers', swatch: ['#0c1112', '#141c1d', '#1fb5a3'] },
  {
    id: 'drake',
    label: 'Drake',
    group: 'Manufacturers',
    swatch: ['#0e0e0d', '#181816', '#f2b705'],
  },
  {
    id: 'anvil',
    label: 'Anvil',
    group: 'Manufacturers',
    swatch: ['#0c0e0b', '#151912', '#7cb342'],
  },
  {
    id: 'aegis',
    label: 'Aegis',
    group: 'Manufacturers',
    swatch: ['#0d0d0f', '#17171a', '#e0442f'],
  },
  { id: 'argo', label: 'Argo', group: 'Manufacturers', swatch: ['#121315', '#1b1d20', '#ffc400'] },
  {
    id: 'cnou',
    label: 'Consolidated Outland',
    group: 'Manufacturers',
    swatch: ['#f7f6f4', '#ffffff', '#f26b1d'],
  },
  {
    id: 'aopoa',
    label: 'Aopoa',
    group: 'Manufacturers',
    swatch: ['#080917', '#10122a', '#6d5dfc'],
  },
] as const;

export const FONTS = [
  { id: 'system', label: 'System', sample: 'system-ui' },
  { id: 'inter', label: 'Inter', sample: 'Inter' },
  { id: 'exo', label: 'Exo 2', sample: 'Exo 2' },
  { id: 'rajdhani', label: 'Rajdhani', sample: 'Rajdhani' },
  { id: 'rajdhani-inter', label: 'Rajdhani + Inter', sample: 'Rajdhani' },
  { id: 'orbitron', label: 'Orbitron + Inter', sample: 'Orbitron' },
  { id: 'chakra', label: 'Chakra Petch', sample: 'Chakra Petch' },
  { id: 'grotesk', label: 'Space Grotesk', sample: 'Space Grotesk' },
] as const;

export const STYLES = [
  { id: 'clean', label: 'Clean', note: 'Soft, rounded, calm' },
  { id: 'hud', label: 'HUD', note: 'Clipped corners, glow, grid' },
  { id: 'glass', label: 'Glass', note: 'Frosted panels, lit background' },
  { id: 'industrial', label: 'Industrial', note: 'Sharp, striped, bold' },
] as const;

// What sits behind the page. Light palettes always get 'plain' (see SpaceBackdrop).
export const BACKDROPS = [
  { id: 'space', label: 'Space', note: 'Drifting stars and a nebula glow' },
  { id: 'plain', label: 'Plain', note: 'Just the palette colour' },
] as const;

export const DEFAULT_THEME = {
  palette: 'hangar',
  font: 'system',
  style: 'clean',
  backdrop: 'space',
};
export type Theme = typeof DEFAULT_THEME;

export function readTheme(cookie: string | undefined): Theme {
  // Older values have three parts; a missing backdrop means the default.
  const [palette, font, style, backdrop] = String(cookie || '').split('.');
  return {
    palette: PALETTES.some((x) => x.id === palette) ? palette : DEFAULT_THEME.palette,
    font: FONTS.some((x) => x.id === font) ? font : DEFAULT_THEME.font,
    style: STYLES.some((x) => x.id === style) ? style : DEFAULT_THEME.style,
    backdrop: BACKDROPS.some((x) => x.id === backdrop) ? backdrop : DEFAULT_THEME.backdrop,
  };
}
export const themeValue = (t: Theme) => `${t.palette}.${t.font}.${t.style}.${t.backdrop}`;

// Google Fonts families needed for a font choice ('' = none).
const FAMILIES: Record<string, string> = {
  inter: 'Inter:wght@400;600;700',
  exo: 'Exo+2:wght@400;600;700',
  rajdhani: 'Rajdhani:wght@500;600;700',
  'rajdhani-inter': 'Rajdhani:wght@500;600;700&family=Inter:wght@400;600;700',
  orbitron: 'Orbitron:wght@500;700&family=Inter:wght@400;600;700',
  chakra: 'Chakra+Petch:wght@400;600;700',
  grotesk: 'Space+Grotesk:wght@400;600;700',
};
export function fontHref(ids: string[]) {
  const fam = ids.map((id) => FAMILIES[id]).filter(Boolean);
  return fam.length
    ? `https://fonts.googleapis.com/css2?family=${fam.join('&family=')}&display=swap`
    : '';
}
export const ALL_FONT_IDS = FONTS.map((f) => f.id);
