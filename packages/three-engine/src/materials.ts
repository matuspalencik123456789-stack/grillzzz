import * as THREE from 'three';
import type { MaterialType, SurfaceFinish } from '@grillz/shared-types';

export interface MetalAppearance {
  color: string;
  metalness: number;
  roughness: number;
}

/** Viewer-side defaults; server Material rows can override color/roughness. */
export const METAL_APPEARANCE: Record<MaterialType, MetalAppearance> = {
  GOLD_10K: { color: '#d9b45b', metalness: 1, roughness: 0.18 },
  GOLD_14K: { color: '#e3bd58', metalness: 1, roughness: 0.15 },
  GOLD_18K: { color: '#f0c649', metalness: 1, roughness: 0.12 },
  WHITE_GOLD: { color: '#e8e6df', metalness: 1, roughness: 0.14 },
  ROSE_GOLD: { color: '#e6a17c', metalness: 1, roughness: 0.15 },
  SILVER: { color: '#d8d8d8', metalness: 1, roughness: 0.2 },
  PLATINUM: { color: '#e2e4e5', metalness: 1, roughness: 0.1 },
};

const FINISH_ADJUST: Record<SurfaceFinish, { roughnessAdd: number; clearcoat: number }> = {
  GLOSS: { roughnessAdd: 0, clearcoat: 0.6 },
  MATTE: { roughnessAdd: 0.35, clearcoat: 0 },
  BRUSHED: { roughnessAdd: 0.22, clearcoat: 0.1 },
  HAMMERED: { roughnessAdd: 0.12, clearcoat: 0.25 },
};

/**
 * PBR metal for grillz previews. MeshPhysicalMaterial for clearcoat — the
 * difference between "gold-ish" and "jewelry" under an HDRI.
 */
export function createMetalMaterial(
  material: MaterialType,
  finish: SurfaceFinish,
  overrides: Partial<MetalAppearance> = {},
): THREE.MeshPhysicalMaterial {
  const appearance = { ...METAL_APPEARANCE[material], ...overrides };
  const adjust = FINISH_ADJUST[finish];
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(appearance.color),
    metalness: appearance.metalness,
    roughness: Math.min(1, appearance.roughness + adjust.roughnessAdd),
    clearcoat: adjust.clearcoat,
    clearcoatRoughness: 0.25,
    envMapIntensity: 1.15,
  });
}

/** Neutral enamel-like material for the scanned teeth. */
export function createToothMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#efe9df'),
    metalness: 0,
    roughness: 0.42,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
    envMapIntensity: 0.5,
  });
}

export const HIGHLIGHT_COLORS = {
  hover: '#67e8f9',
  selected: '#f0c649',
} as const;
