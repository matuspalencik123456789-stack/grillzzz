import type { RawMesh } from './types';

/**
 * Area-weighted vertex normals. Weighting by (unnormalized) face cross
 * products gives larger faces more influence, which is the standard smooth
 * shading choice for organic surfaces like dental scans.
 */
export function computeVertexNormals(mesh: RawMesh): RawMesh {
  const vertexCount = mesh.positions.length / 3;
  const normals = new Float32Array(vertexCount * 3);
  const p = mesh.positions;

  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t]!, b = mesh.indices[t + 1]!, c = mesh.indices[t + 2]!;
    const ax = p[a * 3]!, ay = p[a * 3 + 1]!, az = p[a * 3 + 2]!;
    const abx = p[b * 3]! - ax, aby = p[b * 3 + 1]! - ay, abz = p[b * 3 + 2]! - az;
    const acx = p[c * 3]! - ax, acy = p[c * 3 + 1]! - ay, acz = p[c * 3 + 2]! - az;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    for (const v of [a, b, c]) {
      normals[v * 3] = normals[v * 3]! + nx;
      normals[v * 3 + 1] = normals[v * 3 + 1]! + ny;
      normals[v * 3 + 2] = normals[v * 3 + 2]! + nz;
    }
  }

  for (let v = 0; v < vertexCount; v++) {
    const x = normals[v * 3]!, y = normals[v * 3 + 1]!, z = normals[v * 3 + 2]!;
    const len = Math.hypot(x, y, z);
    if (len > 1e-12) {
      normals[v * 3] = x / len;
      normals[v * 3 + 1] = y / len;
      normals[v * 3 + 2] = z / len;
    } else {
      normals[v * 3 + 2] = 1;
    }
  }

  return { ...mesh, normals };
}
