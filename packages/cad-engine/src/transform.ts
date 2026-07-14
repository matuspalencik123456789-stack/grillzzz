import type { BoundingBox, Vec3 } from '@grillz/shared-types';
import type { RawMesh } from './types';

export function computeBounds(mesh: RawMesh): BoundingBox {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const v = mesh.positions[i + a]!;
      if (Number.isFinite(v)) {
        if (v < min[a]!) min[a] = v;
        if (v > max[a]!) max[a] = v;
      }
    }
  }
  return { min, max };
}

/** Translate the mesh so its bounding-box center sits at the origin. In place. */
export function centerMesh(mesh: RawMesh): { mesh: RawMesh; offset: Vec3 } {
  const bounds = computeBounds(mesh);
  const offset: Vec3 = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  for (let i = 0; i < mesh.positions.length; i += 3) {
    mesh.positions[i] = mesh.positions[i]! - offset[0];
    mesh.positions[i + 1] = mesh.positions[i + 1]! - offset[1];
    mesh.positions[i + 2] = mesh.positions[i + 2]! - offset[2];
  }
  return { mesh, offset };
}

/**
 * Rescale meshes exported in the wrong unit. Dental arches are 30–120 mm; if
 * the largest extent is ~1000× off in either direction (metres or microns),
 * apply the corrective power of 10. No-op otherwise.
 */
export function normalizeUnitsToMm(mesh: RawMesh): { mesh: RawMesh; scaleApplied: number } {
  const bounds = computeBounds(mesh);
  const maxSpan = Math.max(
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  );
  let scale = 1;
  if (maxSpan > 0 && maxSpan < 0.3) scale = 1000; // metres → mm
  else if (maxSpan > 3000) scale = 0.001; // microns → mm
  else if (maxSpan >= 0.3 && maxSpan < 12) scale = 10; // centimetres → mm
  if (scale !== 1) {
    for (let i = 0; i < mesh.positions.length; i++) {
      mesh.positions[i] = mesh.positions[i]! * scale;
    }
  }
  return { mesh, scaleApplied: scale };
}
