import type { RawMesh } from '../types';

/**
 * STL parser (binary + ASCII). STL is triangle soup — vertices are emitted
 * per-facet and welded later by optimizeMesh().
 */
export function parseStl(data: Uint8Array): RawMesh {
  if (isAsciiStl(data)) return parseAsciiStl(data);
  return parseBinaryStl(data);
}

function isAsciiStl(data: Uint8Array): boolean {
  // Binary files may also begin with "solid"; the only reliable test is the
  // binary size invariant: 84 + 50 × triangleCount bytes.
  if (data.length < 84) return true;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const declared = view.getUint32(80, true);
  if (data.length === 84 + declared * 50) return false;
  const head = new TextDecoder().decode(data.subarray(0, Math.min(512, data.length)));
  return head.trimStart().startsWith('solid') && head.includes('facet');
}

function parseBinaryStl(data: Uint8Array): RawMesh {
  if (data.length < 84) throw new Error('STL: file too small for binary header');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const triCount = view.getUint32(80, true);
  const expected = 84 + triCount * 50;
  if (data.length < expected) {
    throw new Error(`STL: truncated binary file (expected ${expected} bytes, got ${data.length})`);
  }
  const positions = new Float32Array(triCount * 9);
  const indices = new Uint32Array(triCount * 3);
  let offset = 84;
  for (let t = 0; t < triCount; t++) {
    offset += 12; // skip facet normal — recomputed from geometry
    for (let v = 0; v < 3; v++) {
      const p = (t * 3 + v) * 3;
      positions[p] = view.getFloat32(offset, true);
      positions[p + 1] = view.getFloat32(offset + 4, true);
      positions[p + 2] = view.getFloat32(offset + 8, true);
      offset += 12;
      indices[t * 3 + v] = t * 3 + v;
    }
    offset += 2; // attribute byte count
  }
  return { positions, indices };
}

const VERTEX_RE = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g;

function parseAsciiStl(data: Uint8Array): RawMesh {
  const text = new TextDecoder().decode(data);
  const coords: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = VERTEX_RE.exec(text)) !== null) {
    coords.push(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  VERTEX_RE.lastIndex = 0;
  if (coords.length === 0 || coords.length % 9 !== 0) {
    throw new Error(`STL: malformed ASCII file (${coords.length / 3} vertices)`);
  }
  const positions = new Float32Array(coords);
  const indices = new Uint32Array(coords.length / 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  return { positions, indices };
}
