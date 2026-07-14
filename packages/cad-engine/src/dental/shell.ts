import type { GrillzGeometry, TriangleRange } from '@grillz/shared-types';
import type { RawMesh } from '../types';
import { computeVertexNormals } from '../normals';

/**
 * Builds the manufacturable grillz shell from the scanned teeth it covers.
 *
 * inner surface  = tooth surface offset outward by `fitToleranceMm` (cement
 *                  gap), triangles flipped so normals face the tooth
 * outer surface  = tooth surface offset outward by fit + offset + thickness
 * rim            = quad strip stitching inner and outer boundary loops
 *
 * The result is a closed shell suitable for STL/OBJ/GLB manufacturing export.
 * Chamfer/edge radius are cosmetic CNC parameters carried in the production
 * report; they are not applied to the mesh here (they are below printer
 * resolution for the 0.2–0.6 mm range we allow).
 */
export function buildGrillzShell(
  scanMesh: RawMesh,
  toothRanges: TriangleRange[],
  geometry: GrillzGeometry,
): RawMesh {
  const sub = extractSubmesh(scanMesh, toothRanges);
  const withNormals = sub.normals ? sub : computeVertexNormals(sub);
  const normals = withNormals.normals!;
  const vertexCount = sub.positions.length / 3;

  const innerOffset = geometry.fitToleranceMm;
  const outerOffset = geometry.fitToleranceMm + geometry.offsetMm + geometry.thicknessMm;

  // vertices: [0, n) inner, [n, 2n) outer
  const positions = new Float32Array(vertexCount * 6);
  for (let v = 0; v < vertexCount; v++) {
    const px = sub.positions[v * 3]!, py = sub.positions[v * 3 + 1]!, pz = sub.positions[v * 3 + 2]!;
    const nx = normals[v * 3]!, ny = normals[v * 3 + 1]!, nz = normals[v * 3 + 2]!;
    positions[v * 3] = px + nx * innerOffset;
    positions[v * 3 + 1] = py + ny * innerOffset;
    positions[v * 3 + 2] = pz + nz * innerOffset;
    const o = (vertexCount + v) * 3;
    positions[o] = px + nx * outerOffset;
    positions[o + 1] = py + ny * outerOffset;
    positions[o + 2] = pz + nz * outerOffset;
  }

  const triCount = sub.indices.length / 3;
  const boundary = boundaryEdges(sub);
  const indices = new Uint32Array(triCount * 6 + boundary.length * 6);

  let w = 0;
  for (let t = 0; t < triCount; t++) {
    const a = sub.indices[t * 3]!, b = sub.indices[t * 3 + 1]!, c = sub.indices[t * 3 + 2]!;
    // inner: flipped winding so the surface faces the tooth
    indices[w++] = a; indices[w++] = c; indices[w++] = b;
    // outer: original winding, offset vertex block
    indices[w++] = vertexCount + a; indices[w++] = vertexCount + b; indices[w++] = vertexCount + c;
  }
  // rim: two triangles per boundary edge
  for (const [a, b] of boundary) {
    const ao = vertexCount + a, bo = vertexCount + b;
    indices[w++] = a; indices[w++] = b; indices[w++] = bo;
    indices[w++] = a; indices[w++] = bo; indices[w++] = ao;
  }

  return computeVertexNormals({ positions, indices });
}

/** Compacts the triangles of the given ranges into a standalone mesh. */
export function extractSubmesh(mesh: RawMesh, ranges: TriangleRange[]): RawMesh {
  let triTotal = 0;
  for (const r of ranges) triTotal += r.count;

  const remap = new Map<number, number>();
  const indices = new Uint32Array(triTotal * 3);
  const positionsOut: number[] = [];

  let w = 0;
  for (const range of ranges) {
    const start = range.start * 3;
    const end = (range.start + range.count) * 3;
    for (let i = start; i < end; i++) {
      const original = mesh.indices[i]!;
      let mapped = remap.get(original);
      if (mapped === undefined) {
        mapped = positionsOut.length / 3;
        remap.set(original, mapped);
        positionsOut.push(
          mesh.positions[original * 3]!,
          mesh.positions[original * 3 + 1]!,
          mesh.positions[original * 3 + 2]!,
        );
      }
      indices[w++] = mapped;
    }
  }

  return { positions: new Float32Array(positionsOut), indices };
}

/** Edges referenced by exactly one triangle, as ordered [from, to] pairs. */
function boundaryEdges(mesh: RawMesh): Array<[number, number]> {
  const counts = new Map<string, [number, number, number]>(); // key → [count, from, to]
  const touch = (from: number, to: number) => {
    const key = from < to ? `${from}:${to}` : `${to}:${from}`;
    const entry = counts.get(key);
    if (entry) entry[0]++;
    else counts.set(key, [1, from, to]);
  };
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t]!, b = mesh.indices[t + 1]!, c = mesh.indices[t + 2]!;
    touch(a, b);
    touch(b, c);
    touch(c, a);
  }
  const result: Array<[number, number]> = [];
  for (const [count, from, to] of counts.values()) {
    if (count === 1) result.push([from, to]);
  }
  return result;
}
