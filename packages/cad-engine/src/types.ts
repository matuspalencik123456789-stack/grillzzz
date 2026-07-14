import type { BoundingBox, Vec3 } from '@grillz/shared-types';

/**
 * Indexed triangle mesh in millimetres. Framework-free typed arrays so the
 * same code runs in Node workers and the browser, and transfers zero-copy
 * to three.js BufferAttributes.
 */
export interface RawMesh {
  positions: Float32Array; // xyz per vertex
  indices: Uint32Array; // 3 per triangle
  normals?: Float32Array; // xyz per vertex, unit length
}

export interface MeshValidationIssue {
  code:
    | 'EMPTY_MESH'
    | 'NON_FINITE_VERTEX'
    | 'INDEX_OUT_OF_RANGE'
    | 'DEGENERATE_TRIANGLE'
    | 'NOT_WATERTIGHT'
    | 'IMPLAUSIBLE_SCALE';
  severity: 'ERROR' | 'WARNING';
  message: string;
  count?: number;
}

export interface MeshValidationResult {
  ok: boolean;
  issues: MeshValidationIssue[];
}

export interface MeshAnalysis {
  vertexCount: number;
  triangleCount: number;
  surfaceAreaMm2: number;
  volumeMm3: number;
  watertight: boolean;
  boundingBox: BoundingBox;
}

export function vertexAt(mesh: RawMesh, index: number): Vec3 {
  const i = index * 3;
  return [mesh.positions[i]!, mesh.positions[i + 1]!, mesh.positions[i + 2]!];
}

export function triangleCount(mesh: RawMesh): number {
  return mesh.indices.length / 3;
}
