import type { RawMesh } from './types';

export interface OptimizeOptions {
  /** vertices closer than this are merged (mm) */
  weldToleranceMm?: number;
}

/**
 * Geometry optimization: spatial-hash vertex welding + degenerate-triangle
 * removal. STL triangle soup typically shrinks ~6× in vertex count, which is
 * what makes realtime per-tooth picking viable in the browser.
 */
export function optimizeMesh(mesh: RawMesh, options: OptimizeOptions = {}): RawMesh {
  const tolerance = options.weldToleranceMm ?? 1e-4;
  const inv = 1 / tolerance;

  const vertexCount = mesh.positions.length / 3;
  const remap = new Uint32Array(vertexCount);
  const cellMap = new Map<string, number>();
  const outPositions: number[] = [];

  for (let v = 0; v < vertexCount; v++) {
    const x = mesh.positions[v * 3]!;
    const y = mesh.positions[v * 3 + 1]!;
    const z = mesh.positions[v * 3 + 2]!;
    const key = `${Math.round(x * inv)},${Math.round(y * inv)},${Math.round(z * inv)}`;
    let target = cellMap.get(key);
    if (target === undefined) {
      target = outPositions.length / 3;
      cellMap.set(key, target);
      outPositions.push(x, y, z);
    }
    remap[v] = target;
  }

  const outIndices: number[] = [];
  const positions = outPositions;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = remap[mesh.indices[t]!]!;
    const b = remap[mesh.indices[t + 1]!]!;
    const c = remap[mesh.indices[t + 2]!]!;
    if (a === b || b === c || a === c) continue;
    if (areaSq(positions, a, b, c) < 1e-16) continue;
    outIndices.push(a, b, c);
  }

  return {
    positions: new Float32Array(outPositions),
    indices: new Uint32Array(outIndices),
  };
}

function areaSq(positions: number[], a: number, b: number, c: number): number {
  const ax = positions[a * 3]!, ay = positions[a * 3 + 1]!, az = positions[a * 3 + 2]!;
  const abx = positions[b * 3]! - ax, aby = positions[b * 3 + 1]! - ay, abz = positions[b * 3 + 2]! - az;
  const acx = positions[c * 3]! - ax, acy = positions[c * 3 + 1]! - ay, acz = positions[c * 3 + 2]! - az;
  const cx = aby * acz - abz * acy;
  const cy = abz * acx - abx * acz;
  const cz = abx * acy - aby * acx;
  return 0.25 * (cx * cx + cy * cy + cz * cz);
}
