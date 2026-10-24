// CueThemes.js — Color & finish presets for the cue stick
// All properties are { color, roughness?, metalness? } objects for MeshStandardMaterial

const _ = (color, roughness, metalness) => ({
  color: typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color,
  roughness,
  metalness,
});

export const CUE_THEMES = {
  default: {
    shaft:  _(0xc58d55, 0.42, 0.04),
    ferrule:_(0xf1eadc, 0.28, 0.02),
    tip:    _(0x2c1b12, 0.72, 0.00),
    wrap:   _(0x111316, 0.55, 0.08),
    ring:   _(0xc9b483, 0.22, 0.55),
    butt:   _(0x5a301b, 0.36, 0.08),
    inlay:  _(0xe6d7ad, 0.24, 0.18),
  },
  black: {
    shaft:  _(0x222222, 0.35, 0.10),
    ferrule:_(0xe8e0d4, 0.28, 0.02),
    tip:    _(0x1a1a1a, 0.72, 0.00),
    wrap:   _(0x1a1a1a, 0.60, 0.12),
    ring:   _(0x888888, 0.20, 0.65),
    butt:   _(0x1a1a1a, 0.35, 0.15),
    inlay:  _(0xcccccc, 0.24, 0.30),
  },
  blue: {
    shaft:  _(0x8ab4d4, 0.38, 0.08),
    ferrule:_(0xf0ece4, 0.28, 0.02),
    tip:    _(0x2c1b12, 0.72, 0.00),
    wrap:   _(0x0e2a44, 0.55, 0.10),
    ring:   _(0xb0c4de, 0.22, 0.50),
    butt:   _(0x0e2a44, 0.36, 0.12),
    inlay:  _(0x87ceeb, 0.24, 0.20),
  },
  red: {
    shaft:  _(0xd4886e, 0.42, 0.05),
    ferrule:_(0xf5ece4, 0.28, 0.02),
    tip:    _(0x2c1b12, 0.72, 0.00),
    wrap:   _(0x5c1515, 0.55, 0.08),
    ring:   _(0xc9a07a, 0.22, 0.55),
    butt:   _(0x5c1515, 0.36, 0.08),
    inlay:  _(0xdd9a8a, 0.24, 0.18),
  },
  green: {
    shaft:  _(0x8fa870, 0.42, 0.05),
    ferrule:_(0xf0ece4, 0.28, 0.02),
    tip:    _(0x2c1b12, 0.72, 0.00),
    wrap:   _(0x1b2e1b, 0.55, 0.08),
    ring:   _(0xaab87a, 0.22, 0.50),
    butt:   _(0x1b2e1b, 0.36, 0.08),
    inlay:  _(0x9eb88a, 0.24, 0.18),
  },
  gold: {
    shaft:  _(0xd4a84c, 0.38, 0.15),
    ferrule:_(0xf5ece0, 0.28, 0.02),
    tip:    _(0x2c1b12, 0.72, 0.00),
    wrap:   _(0x2a1e0b, 0.55, 0.10),
    ring:   _(0xe5c87a, 0.18, 0.70),
    butt:   _(0x2a1e0b, 0.36, 0.12),
    inlay:  _(0xf2dea8, 0.22, 0.30),
  },
};

export function applyCueTheme(materials, theme) {
  for (const [key, mat] of Object.entries(materials)) {
    const t = theme[key];
    if (!t || !mat) continue;
    if (t.color != null)    mat.color.setHex(t.color);
    if (t.roughness != null) mat.roughness = t.roughness;
    if (t.metalness != null) mat.metalness = t.metalness;
  }
}
