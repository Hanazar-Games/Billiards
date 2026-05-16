/**
 * RoomThemes — Color & material presets for the pool-hall environment.
 */

const _c = (hex) => typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex;

// ── Floor presets ──
export const FLOOR_THEMES = {
  tile: {
    floor:       { color: _c('#e0d5c0'), roughness: 0.92, metalness: 0.0 },
    floorLine:   { color: _c('#d4c8b0'), roughness: 0.90, metalness: 0.0 },
  },
  wood: {
    floor:       { color: _c('#8a7050'), roughness: 0.82, metalness: 0.0 },
    floorLine:   { color: _c('#7a6040'), roughness: 0.80, metalness: 0.0 },
  },
  dark: {
    floor:       { color: _c('#2a2a2a'), roughness: 0.88, metalness: 0.05 },
    floorLine:   { color: _c('#3a3a3a'), roughness: 0.86, metalness: 0.05 },
  },
};

// ── Wall presets ──
export const WALL_THEMES = {
  warm: {
    wall:        { color: _c('#f5e6c8'), roughness: 0.88, metalness: 0.02 },
    ceiling:     { color: _c('#f5e6c8'), roughness: 0.90, metalness: 0.02 },
    grid:        { color: _c('#3a3530'), roughness: 0.85, metalness: 0.05 },
  },
  neutral: {
    wall:        { color: _c('#d8d8d8'), roughness: 0.88, metalness: 0.02 },
    ceiling:     { color: _c('#d8d8d8'), roughness: 0.90, metalness: 0.02 },
    grid:        { color: _c('#5a5a5a'), roughness: 0.85, metalness: 0.05 },
  },
  dark: {
    wall:        { color: _c('#2a2a2a'), roughness: 0.88, metalness: 0.05 },
    ceiling:     { color: _c('#2a2a2a'), roughness: 0.90, metalness: 0.05 },
    grid:        { color: _c('#1a1a1a'), roughness: 0.85, metalness: 0.08 },
  },
};

// ── Lamp style presets ──
export const LAMP_STYLE_THEMES = {
  classic: {
    diffuser:    { color: _c('#fff1cc'), emissive: _c('#ffd98a'), emissiveIntensity: 1.2, roughness: 0.20 },
    crossbar:    { color: _c('#2b2418'), emissive: _c('#4a3214'), emissiveIntensity: 0.25, roughness: 0.45, metalness: 0.25 },
    rod:         { color: _c('#8a7a68'), roughness: 0.35, metalness: 0.65 },
    spotColor:   _c('#ffe4b0'),
    spotIntensity: 1.25,
    pointColor:  _c('#fff5e0'),
    pointIntensity: 0.28,
  },
  modern: {
    diffuser:    { color: _c('#ffffff'), emissive: _c('#e0f0ff'), emissiveIntensity: 1.0, roughness: 0.15 },
    crossbar:    { color: _c('#1a1a1a'), emissive: _c('#000000'), emissiveIntensity: 0.0, roughness: 0.25, metalness: 0.40 },
    rod:         { color: _c('#666666'), roughness: 0.25, metalness: 0.75 },
    spotColor:   _c('#f0f8ff'),
    spotIntensity: 1.4,
    pointColor:  _c('#f0f4ff'),
    pointIntensity: 0.35,
  },
  tournament: {
    diffuser:    { color: _c('#fff8e0'), emissive: _c('#ffe080'), emissiveIntensity: 1.6, roughness: 0.18 },
    crossbar:    { color: _c('#1e1e1e'), emissive: _c('#3a2808'), emissiveIntensity: 0.30, roughness: 0.40, metalness: 0.30 },
    rod:         { color: _c('#555555'), roughness: 0.30, metalness: 0.70 },
    spotColor:   _c('#fff0c0'),
    spotIntensity: 1.8,
    pointColor:  _c('#fff8e0'),
    pointIntensity: 0.22,
  },
};

// ── Ambient light presets ──
export const AMBIENT_LIGHT_THEMES = {
  warm: {
    ambientColor: _c('#fff5e0'),
    ambientIntensity: 0.5,
  },
  neutral: {
    ambientColor: _c('#f0f0f0'),
    ambientIntensity: 0.55,
  },
  cool: {
    ambientColor: _c('#e0e8ff'),
    ambientIntensity: 0.45,
  },
};

// ── Full room presets ──
export const ROOM_THEMES = {
  club:       { floor: 'tile',    wall: 'warm',     lamp: 'classic',    ambient: 'warm' },
  modern:     { floor: 'dark',    wall: 'neutral',  lamp: 'modern',     ambient: 'neutral' },
  tournament: { floor: 'tile',    wall: 'neutral',  lamp: 'tournament', ambient: 'cool' },
  minimal:    { floor: 'wood',    wall: 'warm',     lamp: 'modern',     ambient: 'warm' },
};

/**
 * Apply a theme object (subset of material properties) to a MeshStandardMaterial.
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
}
