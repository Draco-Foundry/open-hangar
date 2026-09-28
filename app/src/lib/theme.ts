// Design options (see styles/themes.css). The choice lives in the `oh_theme`
// cookie as "palette.font.style" so pages render in it on the server.
export const PALETTES = [
  { id: 'hangar', label: 'Hangar Blue', swatch: ['#0d1117', '#161b22', '#2f81f7'] },
  { id: 'steel', label: 'Foundry Steel', swatch: ['#0a0e14', '#121821', '#1ea7ff'] },
  { id: 'quantum', label: 'Quantum Teal', swatch: ['#060b16', '#0c1526', '#14d3c3'] },
  { id: 'crusader', label: 'Crusader Amber', swatch: ['#0f0e0c', '#1a1815', '#f0a020'] },
  { id: 'drake', label: 'Drake Rust', swatch: ['#100b0a', '#1b1311', '#e5533d'] },
  { id: 'aegis', label: 'Aegis Violet', swatch: ['#0b0a12', '#14121f', '#8b5cf6'] },
  { id: 'origin', label: 'Origin Light', swatch: ['#f6f5f2', '#ffffff', '#b08a3e'] },
] as const;

export const FONTS = [
  { id: 'system', label: 'System', sample: 'system-ui' },
  { id: 'inter', label: 'Inter', sample: 'Inter' },
  { id: 'exo', label: 'Exo 2', sample: 'Exo 2' },
  { id: 'rajdhani', label: 'Rajdhani', sample: 'Rajdhani' },
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

export const DEFAULT_THEME = { palette: 'hangar', font: 'system', style: 'clean' };
export type Theme = typeof DEFAULT_THEME;

export function readTheme(cookie: string | undefined): Theme {
  const [palette, font, style] = String(cookie || '').split('.');
  return {
    palette: PALETTES.some((x) => x.id === palette) ? palette : DEFAULT_THEME.palette,
    font: FONTS.some((x) => x.id === font) ? font : DEFAULT_THEME.font,
    style: STYLES.some((x) => x.id === style) ? style : DEFAULT_THEME.style,
  };
}

// Google Fonts families needed for a font choice ('' = none).
const FAMILIES: Record<string, string> = {
  inter: 'Inter:wght@400;600;700',
  exo: 'Exo+2:wght@400;600;700',
  rajdhani: 'Rajdhani:wght@500;600;700',
  orbitron: 'Orbitron:wght@500;700&family=Inter:wght@400;600;700',
  chakra: 'Chakra+Petch:wght@400;600;700',
  grotesk: 'Space+Grotesk:wght@400;600;700',
};
export function fontHref(ids: string[]) {
  const fam = ids.map((id) => FAMILIES[id]).filter(Boolean);
  return fam.length ? `https://fonts.googleapis.com/css2?family=${fam.join('&family=')}&display=swap` : '';
}
export const ALL_FONT_IDS = FONTS.map((f) => f.id);
