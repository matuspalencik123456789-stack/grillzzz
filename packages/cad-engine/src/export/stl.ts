import type { RawMesh } from '../types';

/** Binary STL writer — the lingua franca of dental CAM. */
export function exportStl(mesh: RawMesh, header = 'Grillz Studio manufacturing export'): Uint8Array {
  const triCount = mesh.indices.length / 3;
  const out = new Uint8Array(84 + triCount * 50);
  const view = new DataView(out.buffer);

  const headerBytes = new TextEncoder().encode(header.slice(0, 79));
  out.set(headerBytes, 0);
  view.setUint32(80, triCount, true);

  const p = mesh.positions;
  let offset = 84;
  for (let t = 0; t < triCount; t++) {
    const a = mesh.indices[t * 3]! * 3, b = mesh.indices[t * 3 + 1]! * 3, c = mesh.indices[t * 3 + 2]! * 3;
    const ax = p[a]!, ay = p[a + 1]!, az = p[a + 2]!;
    const abx = p[b]! - ax, aby = p[b + 1]! - ay, abz = p[b + 2]! - az;
    const acx = p[c]! - ax, acy = p[c + 1]! - ay, acz = p[c + 2]! - az;
    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const len = Math.hypot(nx, ny, nz);
    if (len > 1e-12) { nx /= len; ny /= len; nz /= len; } else { nx = 0; ny = 0; nz = 1; }

    view.setFloat32(offset, nx, true);
    view.setFloat32(offset + 4, ny, true);
    view.setFloat32(offset + 8, nz, true);
    offset += 12;
    for (const idx of [a, b, c]) {
      view.setFloat32(offset, p[idx]!, true);
      view.setFloat32(offset + 4, p[idx + 1]!, true);
      view.setFloat32(offset + 8, p[idx + 2]!, true);
      offset += 12;
    }
    view.setUint16(offset, 0, true);
    offset += 2;
  }
  return out;
}
