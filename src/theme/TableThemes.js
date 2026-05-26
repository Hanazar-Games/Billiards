/**
 * TableThemes — Color & material presets for procedural table geometry.
 * All values are for MeshStandardMaterial properties (color as hex integer).
 */

const _c = (hex) => typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex;

// ── Felt presets ──
export const FELT_THEMES = {
  classicGreen: {
    felt:        { color: _c('#0d5c3a'), roughness: 0.88, metalness: 0.0 },
    cushion:     { color: _c('#0a4a2e'), roughness: 0.78, metalness: 0.0 },
    bevel:       { color: _c('#0b5c32'), roughness: 0.85, metalness: 0.0 },
    nap:         { color: _c('#116b45'), roughness: 1.0,  metalness: 0.0, opacity: 0.32 },
    edge:        { color: _c('#083a25'), roughness: 0.95, metalness: 0.0 },
  },
  blue: {
    felt:        { color: _c('#0a3a5c'), roughness: 0.88, metalness: 0.0 },
    cushion:     { color: _c('#082e4a'), roughness: 0.78, metalness: 0.0 },
    bevel:       { color: _c('#0a3d5e'), roughness: 0.85, metalness: 0.0 },
    nap:         { color: _c('#0d4a6e'), roughness: 1.0,  metalness: 0.0, opacity: 0.32 },
    edge:        { color: _c('#052238'), roughness: 0.95, metalness: 0.0 },
  },
  red: {
    felt:        { color: _c('#5c0a1a'), roughness: 0.88, metalness: 0.0 },
    cushion:     { color: _c('#4a0814'), roughness: 0.78, metalness: 0.0 },
    bevel:       { color: _c('#5c0e1e'), roughness: 0.85, metalness: 0.0 },
    nap:         { color: _c('#6e1028'), roughness: 1.0,  metalness: 0.0, opacity: 0.32 },
    edge:        { color: _c('#38050e'), roughness: 0.95, metalness: 0.0 },
  },
  black: {
    felt:        { color: _c('#1a1a1a'), roughness: 0.90, metalness: 0.0 },
    cushion:     { color: _c('#141414'), roughness: 0.80, metalness: 0.0 },
    bevel:       { color: _c('#181818'), roughness: 0.86, metalness: 0.0 },
    nap:         { color: _c('#222222'), roughness: 1.0,  metalness: 0.0, opacity: 0.28 },
    edge:        { color: _c('#0a0a0a'), roughness: 0.95, metalness: 0.0 },
  },
  purple: {
    felt:        { color: _c('#3a0d4a'), roughness: 0.88, metalness: 0.0 },
    cushion:     { color: _c('#2e0a3a'), roughness: 0.78, metalness: 0.0 },
    bevel:       { color: _c('#3a0e4e'), roughness: 0.85, metalness: 0.0 },
    nap:         { color: _c('#4a105e'), roughness: 1.0,  metalness: 0.0, opacity: 0.32 },
    edge:        { color: _c('#1e0530'), roughness: 0.95, metalness: 0.0 },
  },
};

// ── Wood presets ──
export const WOOD_THEMES = {
  classic: {
    rail:        { color: _c('#221a16'), roughness: 0.42, metalness: 0.03 },
    topInsert:   { color: _c('#604328'), roughness: 0.35, metalness: 0.02 },
    round:       { color: _c('#2e231d'), roughness: 0.32, metalness: 0.04 },
    railBevel:   { color: _c('#9c5e26'), roughness: 0.38, metalness: 0.03 },
    apron:       { color: _c('#151313'), roughness: 0.48, metalness: 0.02 },
    leg:         { color: _c('#15100d'), roughness: 0.50, metalness: 0.02 },
    legFace:     { color: _c('#2d2118'), roughness: 0.40, metalness: 0.03 },
  },
  darkWalnut: {
    rail:        { color: _c('#1e1814'), roughness: 0.40, metalness: 0.03 },
    topInsert:   { color: _c('#4a3524'), roughness: 0.33, metalness: 0.02 },
    round:       { color: _c('#282018'), roughness: 0.30, metalness: 0.04 },
    railBevel:   { color: _c('#7a4e22'), roughness: 0.36, metalness: 0.03 },
    apron:       { color: _c('#121010'), roughness: 0.46, metalness: 0.02 },
    leg:         { color: _c('#120e0b'), roughness: 0.48, metalness: 0.02 },
    legFace:     { color: _c('#281e16'), roughness: 0.38, metalness: 0.03 },
  },
  lightOak: {
    rail:        { color: _c('#8a7058'), roughness: 0.44, metalness: 0.02 },
    topInsert:   { color: _c('#a68868'), roughness: 0.38, metalness: 0.02 },
    round:       { color: _c('#7a644e'), roughness: 0.36, metalness: 0.03 },
    railBevel:   { color: _c('#b89a78'), roughness: 0.40, metalness: 0.02 },
    apron:       { color: _c('#5c4a3a'), roughness: 0.48, metalness: 0.02 },
    leg:         { color: _c('#544434'), roughness: 0.50, metalness: 0.02 },
    legFace:     { color: _c('#6e5844'), roughness: 0.42, metalness: 0.02 },
  },
  blackLacquer: {
    rail:        { color: _c('#0f0f0f'), roughness: 0.18, metalness: 0.35 },
    topInsert:   { color: _c('#1a1a1a'), roughness: 0.14, metalness: 0.30 },
    round:       { color: _c('#111111'), roughness: 0.12, metalness: 0.40 },
    railBevel:   { color: _c('#222222'), roughness: 0.16, metalness: 0.32 },
    apron:       { color: _c('#0a0a0a'), roughness: 0.18, metalness: 0.38 },
    leg:         { color: _c('#080808'), roughness: 0.20, metalness: 0.35 },
    legFace:     { color: _c('#141414'), roughness: 0.16, metalness: 0.30 },
  },
};

// ── Metal trim presets ──
export const METAL_TRIM_THEMES = {
  nickel: {
    trim:        { color: _c('#b9aaa0'), roughness: 0.22, metalness: 0.62 },
    bracket:     { color: _c('#8a8078'), roughness: 0.22, metalness: 0.72 },
    nickel:      { color: _c('#b8b0a6'), roughness: 0.18, metalness: 0.78 },
    seam:        { color: _c('#d8d0c4'), roughness: 0.20, metalness: 0.70 },
    capNickel:   { color: _c('#b6ada3'), roughness: 0.20, metalness: 0.75 },
    leveler:     { color: _c('#c8c0b7'), roughness: 0.18, metalness: 0.85 },
    foot:        { color: _c('#0a0a0a'), roughness: 0.30, metalness: 0.55 },
    apronNickel: { color: _c('#b7aea3'), roughness: 0.20, metalness: 0.72 },
    stretcherNickel: { color: _c('#a89d92'), roughness: 0.20, metalness: 0.70 },
    badge:       { color: _c('#e2d8c9'), roughness: 0.16, metalness: 0.82 },
    casting:     { color: _c('#b8b0a6'), roughness: 0.18, metalness: 0.78 },
    sight:       { color: _c('#f3e6c7'), roughness: 0.18, metalness: 0.05, emissive: _c('#1c1408'), emissiveIntensity: 0.15 },
  },
  gold: {
    trim:        { color: _c('#c9a86c'), roughness: 0.20, metalness: 0.65 },
    bracket:     { color: _c('#a68a50'), roughness: 0.20, metalness: 0.72 },
    nickel:      { color: _c('#d4b87a'), roughness: 0.16, metalness: 0.80 },
    seam:        { color: _c('#e8d8a8'), roughness: 0.18, metalness: 0.72 },
    capNickel:   { color: _c('#c8ae68'), roughness: 0.18, metalness: 0.75 },
    leveler:     { color: _c('#dcc078'), roughness: 0.16, metalness: 0.85 },
    foot:        { color: _c('#1a1208'), roughness: 0.30, metalness: 0.55 },
    apronNickel: { color: _c('#c4a860'), roughness: 0.18, metalness: 0.72 },
    stretcherNickel: { color: _c('#b89a58'), roughness: 0.18, metalness: 0.70 },
    badge:       { color: _c('#f0e0a8'), roughness: 0.14, metalness: 0.85 },
    casting:     { color: _c('#d4b87a'), roughness: 0.16, metalness: 0.80 },
    sight:       { color: _c('#f5e6b8'), roughness: 0.16, metalness: 0.05, emissive: _c('#2a1e08'), emissiveIntensity: 0.15 },
  },
  blackChrome: {
    trim:        { color: _c('#4a4a4a'), roughness: 0.14, metalness: 0.72 },
    bracket:     { color: _c('#3a3a3a'), roughness: 0.12, metalness: 0.80 },
    nickel:      { color: _c('#505050'), roughness: 0.10, metalness: 0.85 },
    seam:        { color: _c('#5c5c5c'), roughness: 0.12, metalness: 0.78 },
    capNickel:   { color: _c('#484848'), roughness: 0.12, metalness: 0.82 },
    leveler:     { color: _c('#606060'), roughness: 0.10, metalness: 0.88 },
    foot:        { color: _c('#111111'), roughness: 0.28, metalness: 0.60 },
    apronNickel: { color: _c('#444444'), roughness: 0.12, metalness: 0.78 },
    stretcherNickel: { color: _c('#3e3e3e'), roughness: 0.12, metalness: 0.75 },
    badge:       { color: _c('#666666'), roughness: 0.10, metalness: 0.88 },
    casting:     { color: _c('#505050'), roughness: 0.10, metalness: 0.85 },
    sight:       { color: _c('#c0c0c0'), roughness: 0.12, metalness: 0.10, emissive: _c('#0a0a0a'), emissiveIntensity: 0.12 },
  },
};

// ── Pocket leather presets ──
export const POCKET_LEATHER_THEMES = {
  brown: {
    leather: { color: _c('#3d2314'), roughness: 0.62, metalness: 0.04 },
    net:     { color: _c('#1a1208'), roughness: 0.72, metalness: 0.08 },
    chain:   { color: _c('#3a2e1e'), roughness: 0.45, metalness: 0.35 },
  },
  black: {
    leather: { color: _c('#1a1a1a'), roughness: 0.60, metalness: 0.06 },
    net:     { color: _c('#0d0d0d'), roughness: 0.70, metalness: 0.10 },
    chain:   { color: _c('#222222'), roughness: 0.40, metalness: 0.45 },
  },
  darkRed: {
    leather: { color: _c('#4a1414'), roughness: 0.62, metalness: 0.04 },
    net:     { color: _c('#1e0808'), roughness: 0.72, metalness: 0.08 },
    chain:   { color: _c('#3e1e1e'), roughness: 0.45, metalness: 0.35 },
  },
};

// ── Full table presets (override felt + wood + metal combos) ──
export const TABLE_THEMES = {
  classic:    { felt: 'classicGreen', wood: 'classic',    metal: 'nickel' },
  blackGold:  { felt: 'black',        wood: 'blackLacquer', metal: 'gold' },
  blueTournament: { felt: 'blue',     wood: 'darkWalnut', metal: 'blackChrome' },
  redClub:    { felt: 'red',          wood: 'darkWalnut', metal: 'gold' },
  minimal:    { felt: 'classicGreen', wood: 'lightOak',   metal: 'nickel' },
};

/**
 * Apply a theme object (subset of material properties) to a MeshStandardMaterial.
 * Only updates properties that are present in the theme object.
 */
export function applyMaterialTheme(material, theme) {
  if (!material || !theme) return;
  if (theme.color != null) material.color.setHex(theme.color);
  if (theme.roughness != null) material.roughness = theme.roughness;
  if (theme.metalness != null) material.metalness = theme.metalness;
  if (theme.emissive != null) {
    material.emissive.setHex(theme.emissive);
    material.emissiveIntensity = theme.emissiveIntensity ?? 1.0;
  }
  if (theme.opacity != null) {
    material.opacity = theme.opacity;
    material.transparent = theme.opacity < 1.0;
  }
}
