/**
 * BallThemes — Material style presets for billiard balls.
 * These adjust MeshStandardMaterial properties (roughness / metalness / emissive)
 * to give different surface finishes without changing geometry or physics.
 */

const _c = (hex) => typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex;

export const BALL_STYLE_PRESETS = {
  standard: {
    roughness: 0.08,
    metalness: 0.05,
    emissiveIntensity: 0,
  },
  glossy: {
    roughness: 0.02,
    metalness: 0.15,
    emissiveIntensity: 0,
  },
  matte: {
    roughness: 0.35,
    metalness: 0.0,
    emissiveIntensity: 0,
  },
  neon: {
    roughness: 0.04,
    metalness: 0.08,
    emissiveIntensity: 0.22,
    emissiveBlend: 0.18,
  },
  retro: {
    roughness: 0.48,
    metalness: 0.0,
    emissiveIntensity: 0,
  },
};

/**
 * Apply a ball style preset to a MeshStandardMaterial.
 * @param {THREE.MeshStandardMaterial} material
 * @param {string} styleName
 * @param {number|null} baseColor — ball colour hex for emissive tint (neon only)
 */
export function applyBallStyle(material, styleName, baseColor = null) {
  const preset = BALL_STYLE_PRESETS[styleName] || BALL_STYLE_PRESETS.standard;
  if (!material || !preset) return;

  material.roughness = preset.roughness;
  material.metalness = preset.metalness;

  if (preset.emissiveBlend && baseColor != null) {
    material.emissive.setHex(baseColor);
    material.emissiveIntensity = preset.emissiveIntensity;
    material.emissive.multiplyScalar(preset.emissiveBlend);
  } else {
    material.emissive.setHex(0x000000);
    material.emissiveIntensity = 0;
  }

  material.needsUpdate = true;
}
