import type { MeshAnalysis, RawMesh } from './types';
import { computeBounds } from './transform';

export function analyzeMesh(mesh: RawMesh): MeshAnalysis {
  const p = mesh.positions;
  let area = 0;
  let signedVolume = 0;

  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t]! * 3, b = mesh.indices[t + 1]! * 3, c = mesh.indices[t + 2]! * 3;
    const ax = p[a]!, ay = p[a + 1]!, az = p[a + 2]!;
    const bx = p[b]!, by = p[b + 1]!, bz = p[b + 2]!;
    const cx = p[c]!, cy = p[c + 1]!, cz = p[c + 2]!;

    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const crx = aby * acz - abz * acy;
    const cry = abz * acx - abx * acz;
    const crz = abx * acy - aby * acx;
    area += 0.5 * Math.hypot(crx, cry, crz);

    // signed tetrahedron volume against the origin (divergence theorem)
    signedVolume += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
  }

  return {
    vertexCount: p.length / 3,
    triangleCount: mesh.indices.length / 3,
    surfaceAreaMm2: area,
    volumeMm3: Math.abs(signedVolume),
    watertight: isWatertight(mesh),
    boundingBox: computeBounds(mesh),
  };
}

/** Every edge must be shared by exactly two triangles. */
export function isWatertight(mesh: RawMesh): boolean {
  const edgeCounts = new Map<number, number>();
  const vertexCount = mesh.positions.length / 3;
  const key = (a: number, b: number) => (a < b ? a * vertexCount + b : b * vertexCount + a);

  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t]!, b = mesh.indices[t + 1]!, c = mesh.indices[t + 2]!;
    for (const k of [key(a, b), key(b, c), key(c, a)]) {
      edgeCounts.set(k, (edgeCounts.get(k) ?? 0) + 1);
    }
  }
  for (const count of edgeCounts.values()) {
    if (count !== 2) return false;
  }
  return true;
}
