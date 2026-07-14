import type { RawMesh } from '../types';

/**
 * Wavefront OBJ parser: v / f statements, fan-triangulation of polygons,
 * negative (relative) indices, v/vt/vn index forms. Materials, groups and
 * texture coordinates are ignored — dental scans carry pure geometry.
 */
export function parseObj(data: Uint8Array): RawMesh {
  const text = new TextDecoder().decode(data);
  const positions: number[] = [];
  const indices: number[] = [];

  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) continue;

    if (line.startsWith('v ')) {
      const parts = line.split(/\s+/);
      const x = Number(parts[1]);
      const y = Number(parts[2]);
      const z = Number(parts[3]);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        throw new Error(`OBJ: malformed vertex line: "${line}"`);
      }
      positions.push(x, y, z);
    } else if (line.startsWith('f ')) {
      const parts = line.split(/\s+/).slice(1);
      if (parts.length < 3) throw new Error(`OBJ: face with <3 vertices: "${line}"`);
      const vertexCount = positions.length / 3;
      const face = parts.map((p) => {
        const idxStr = p.split('/')[0]!;
        let idx = Number(idxStr);
        if (!Number.isFinite(idx) || idx === 0) throw new Error(`OBJ: bad face index "${p}"`);
        if (idx < 0) idx = vertexCount + idx + 1;
        if (idx < 1 || idx > vertexCount) throw new Error(`OBJ: face index out of range "${p}"`);
        return idx - 1;
      });
      for (let i = 1; i < face.length - 1; i++) {
        indices.push(face[0]!, face[i]!, face[i + 1]!);
      }
    }
  }

  if (positions.length === 0 || indices.length === 0) {
    throw new Error('OBJ: no geometry found');
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}
