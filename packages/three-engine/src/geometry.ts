import * as THREE from 'three';
import type { RawMesh } from '@grillz/cad-engine';
import type { TriangleRange } from '@grillz/shared-types';

/** Zero-copy bridge: typed arrays from cad-engine become BufferAttributes. */
export function rawMeshToGeometry(mesh: RawMesh): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  if (mesh.normals) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Per-tooth pickable geometry: each tooth gets its own BufferGeometry that
 * SHARES the parent position/normal attributes and slices only the index
 * buffer — 32 selectable teeth cost one copy of the vertex data.
 */
export function toothGeometry(
  parent: THREE.BufferGeometry,
  fullIndices: Uint32Array,
  range: TriangleRange,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', parent.getAttribute('position'));
  const normal = parent.getAttribute('normal');
  if (normal) geometry.setAttribute('normal', normal);
  const slice = fullIndices.subarray(range.start * 3, (range.start + range.count) * 3);
  geometry.setIndex(new THREE.BufferAttribute(slice, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Level-of-detail decimation for distance rendering: every Nth triangle. */
export function decimateIndices(indices: Uint32Array, keepRatio: number): Uint32Array {
  if (keepRatio >= 1) return indices;
  const triCount = indices.length / 3;
  const step = Math.max(1, Math.round(1 / keepRatio));
  const kept: number[] = [];
  for (let t = 0; t < triCount; t += step) {
    kept.push(indices[t * 3]!, indices[t * 3 + 1]!, indices[t * 3 + 2]!);
  }
  return new Uint32Array(kept);
}
