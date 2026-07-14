import type { RawMesh } from './types';
import { computeVertexNormals } from './normals';

export interface SmoothOptions {
  iterations?: number;
  /** positive smoothing factor per pass */
  lambda?: number;
  /** negative "inflate" factor (Taubin) that counters shrinkage; 0 disables */
  mu?: number;
}

/**
 * Taubin λ|μ mesh smoothing (Laplacian passes with alternating signs, which
 * rounds surfaces without the volume collapse of plain Laplacian). Used for
 * presentation meshes (landing showcase, thumbnails); manufacturing exports
 * always use the unsmoothed scan geometry.
 * Precondition: welded mesh (see optimizeMesh) — smoothing follows shared
 * vertices, so triangle soup would not smooth across seams.
 */
export function smoothMesh(mesh: RawMesh, options: SmoothOptions = {}): RawMesh {
  const iterations = options.iterations ?? 6;
  const lambda = options.lambda ?? 0.5;
  const mu = options.mu ?? -0.53;

  const vertexCount = mesh.positions.length / 3;
  const neighbors: Array<Set<number>> = Array.from({ length: vertexCount }, () => new Set());
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t]!, b = mesh.indices[t + 1]!, c = mesh.indices[t + 2]!;
    neighbors[a]!.add(b).add(c);
    neighbors[b]!.add(a).add(c);
    neighbors[c]!.add(a).add(b);
  }

  let positions = Float32Array.from(mesh.positions);
  let scratch = new Float32Array(positions.length);

  const pass = (factor: number): void => {
    for (let v = 0; v < vertexCount; v++) {
      const around = neighbors[v]!;
      if (around.size === 0) {
        scratch[v * 3] = positions[v * 3]!;
        scratch[v * 3 + 1] = positions[v * 3 + 1]!;
        scratch[v * 3 + 2] = positions[v * 3 + 2]!;
        continue;
      }
      let ax = 0, ay = 0, az = 0;
      for (const n of around) {
        ax += positions[n * 3]!;
        ay += positions[n * 3 + 1]!;
        az += positions[n * 3 + 2]!;
      }
      const inv = 1 / around.size;
      scratch[v * 3] = positions[v * 3]! + factor * (ax * inv - positions[v * 3]!);
      scratch[v * 3 + 1] = positions[v * 3 + 1]! + factor * (ay * inv - positions[v * 3 + 1]!);
      scratch[v * 3 + 2] = positions[v * 3 + 2]! + factor * (az * inv - positions[v * 3 + 2]!);
    }
    [positions, scratch] = [scratch, positions];
  };

  for (let i = 0; i < iterations; i++) {
    pass(lambda);
    if (mu !== 0) pass(mu);
  }

  return computeVertexNormals({ positions, indices: mesh.indices });
}
