import type { ToothRegion } from '@grillz/shared-types';
import { archOrder } from '@grillz/shared-types';
import type { RawMesh } from '../types';
import { computeBounds } from '../transform';
import type { JawDetection } from './jaw';

export interface SegmentationResult {
  /** mesh with triangles reordered so each tooth is a contiguous index range */
  mesh: RawMesh;
  teeth: ToothRegion[];
}

export interface ToothSegmenter {
  /** Precondition: `mesh` must be welded (see optimizeMesh) — tier 1 relies on vertex connectivity. */
  segment(mesh: RawMesh, jaw: JawDetection): SegmentationResult;
}

/** components below this fraction of total area are debris → merged into neighbors */
const MIN_COMPONENT_AREA_FRACTION = 0.005;

/**
 * Arch-parameterization segmenter, two tiers:
 *
 * 1. **Connected components** — several dental CAD exports (and any scan
 *    cleaned in lab software) ship each tooth as a separate shell. Welded
 *    connectivity recovers those exactly; components are ordered by their
 *    polar angle around the arch's circumcenter and mapped onto FDI numbers
 *    centered on the anterior midline.
 * 2. **Even angular division** — continuous single-shell scans fall back to
 *    dividing the angular span around the circumcenter, using the ~π-per-16-
 *    teeth arch relation. The circumcenter (circle through the two posterior
 *    extremes and the anterior tip) keeps the parameterization uniform along
 *    the arch, so partial anterior scans don't overestimate their span.
 *
 * Output triangles are reordered so each tooth is one contiguous
 * `triangleRange` — the viewer builds per-tooth selection groups with zero
 * geometry duplication. Confidence reflects the tier that produced the tooth.
 *
 * Known limits (documented, acceptable for v1): left/right mirror ambiguity
 * without bite registration, and one-sided partial scans are centered on the
 * midline. Replaceable by an ML segmenter behind the same interface.
 */
export class ArchToothSegmenter implements ToothSegmenter {
  segment(mesh: RawMesh, jaw: JawDetection): SegmentationResult {
    const vertical = jaw.verticalAxis;
    const [axisU, axisV] = planarAxes(vertical);

    const triCount = mesh.indices.length / 3;
    if (triCount === 0) return { mesh, teeth: [] };

    // triangle centroids + areas in the occlusal plane
    const centroidsU = new Float64Array(triCount);
    const centroidsV = new Float64Array(triCount);
    const areas = new Float64Array(triCount);
    let totalArea = 0;
    for (let t = 0; t < triCount; t++) {
      const a = mesh.indices[t * 3]!, b = mesh.indices[t * 3 + 1]!, c = mesh.indices[t * 3 + 2]!;
      centroidsU[t] =
        (mesh.positions[a * 3 + axisU]! + mesh.positions[b * 3 + axisU]! + mesh.positions[c * 3 + axisU]!) / 3;
      centroidsV[t] =
        (mesh.positions[a * 3 + axisV]! + mesh.positions[b * 3 + axisV]! + mesh.positions[c * 3 + axisV]!) / 3;
      areas[t] = triangleArea(mesh, t);
      totalArea += areas[t]!;
    }

    // orientation: which side of the occlusal plane the anterior mass sits on
    const bounds = computeBounds(mesh);
    const midU = (bounds.min[axisU]! + bounds.max[axisU]!) / 2;
    const midV = (bounds.min[axisV]! + bounds.max[axisV]!) / 2;
    let massHigh = 0;
    for (let t = 0; t < triCount; t++) if (centroidsV[t]! > midV) massHigh++;
    const sign = massHigh > triCount / 2 ? 1 : -1; // anterior always toward +v'

    const pivot = archPivot(centroidsU, centroidsV, sign, bounds, axisU, axisV);

    const angles = new Float64Array(triCount);
    let minAngle = Infinity;
    let maxAngle = -Infinity;
    for (let t = 0; t < triCount; t++) {
      let angle = Math.atan2((centroidsV[t]! - pivot.v) * sign, centroidsU[t]! - pivot.u);
      // rotate the atan2 branch cut to point posterior (-90°): the anterior
      // tip sits at +90° and no arch geometry ever points straight back, so
      // posterior ends dipping below the pivot can't wrap the span
      if (angle < -Math.PI / 2) angle += 2 * Math.PI;
      angles[t] = angle;
      if (angle < minAngle) minAngle = angle;
      if (angle > maxAngle) maxAngle = angle;
    }
    const span = maxAngle - minAngle;
    if (span <= 0) return { mesh, teeth: [] };

    // ── tier 1: connected components ──────────────────────────────────────
    const componentOf = connectedComponents(mesh);
    const componentStats = new Map<number, { area: number; angleSum: number }>();
    for (let t = 0; t < triCount; t++) {
      const c = componentOf[mesh.indices[t * 3]!]!;
      let s = componentStats.get(c);
      if (!s) {
        s = { area: 0, angleSum: 0 };
        componentStats.set(c, s);
      }
      s.area += areas[t]!;
      s.angleSum += angles[t]! * areas[t]!;
    }

    const large = [...componentStats.entries()]
      .filter(([, s]) => s.area >= totalArea * MIN_COMPONENT_AREA_FRACTION)
      .map(([id, s]) => ({ id, meanAngle: s.angleSum / s.area }));

    let runOf: Int32Array;
    let toothCount: number;
    let fromComponents: boolean;

    if (large.length >= 2 && large.length <= 16) {
      fromComponents = true;
      toothCount = large.length;
      // patient right → left = descending angle
      large.sort((a, b) => b.meanAngle - a.meanAngle);
      const runByComponent = new Map<number, number>(large.map((c, i) => [c.id, i]));
      runOf = new Int32Array(triCount);
      for (let t = 0; t < triCount; t++) {
        const c = componentOf[mesh.indices[t * 3]!]!;
        const run = runByComponent.get(c);
        if (run !== undefined) {
          runOf[t] = run;
        } else {
          // debris component → nearest run by angle
          let best = 0;
          let bestDist = Infinity;
          for (let r = 0; r < large.length; r++) {
            const d = Math.abs(large[r]!.meanAngle - angles[t]!);
            if (d < bestDist) { bestDist = d; best = r; }
          }
          runOf[t] = best;
        }
      }
    } else {
      // ── tier 2: even angular division around the circumcenter ──────────
      fromComponents = false;
      toothCount = Math.max(1, Math.min(16, Math.round((span / Math.PI) * 16)));
      runOf = new Int32Array(triCount);
      for (let t = 0; t < triCount; t++) {
        let bin = Math.floor(((maxAngle - angles[t]!) / span) * toothCount);
        if (bin >= toothCount) bin = toothCount - 1;
        runOf[t] = bin;
      }
    }

    // FDI mapping: center detected teeth on the anterior midline of the arch
    const jawKey = jaw.jaw === 'UPPER' ? 'UPPER' : 'LOWER';
    const order = archOrder(jawKey);
    const startIdx = Math.floor((order.length - toothCount) / 2);
    const fdiForRun = (run: number) => order[Math.min(order.length - 1, startIdx + run)]!;

    // reorder triangles: run-major, preserving original order within runs
    const runCounts = new Array<number>(toothCount).fill(0);
    for (let t = 0; t < triCount; t++) runCounts[runOf[t]!]!++;
    const runStarts = new Array<number>(toothCount).fill(0);
    for (let r = 1; r < toothCount; r++) runStarts[r] = runStarts[r - 1]! + runCounts[r - 1]!;

    const newIndices = new Uint32Array(mesh.indices.length);
    const cursor = [...runStarts];
    for (let t = 0; t < triCount; t++) {
      const run = runOf[t]!;
      const dst = cursor[run]!++;
      newIndices[dst * 3] = mesh.indices[t * 3]!;
      newIndices[dst * 3 + 1] = mesh.indices[t * 3 + 1]!;
      newIndices[dst * 3 + 2] = mesh.indices[t * 3 + 2]!;
    }
    const reordered: RawMesh = { ...mesh, indices: newIndices };

    const teeth: ToothRegion[] = [];
    for (let r = 0; r < toothCount; r++) {
      const start = runStarts[r]!;
      const count = runCounts[r]!;
      if (count === 0) continue;
      const region = regionStats(reordered, start, count);
      teeth.push({
        fdiNumber: fdiForRun(r),
        centroid: region.centroid,
        boundingBox: region.boundingBox,
        surfaceAreaMm2: region.area,
        triangleRange: { start, count },
        confidence: fromComponents ? 0.9 : 0.55,
      });
    }

    return { mesh: reordered, teeth };
  }
}

/**
 * Arch pivot = circumcenter of the circle through the two posterior extremes
 * and the anterior tip of the arch. Falls back to a point well behind the
 * posterior edge when the three extremes are nearly colinear (single tooth,
 * flat fragments).
 */
function archPivot(
  centroidsU: Float64Array,
  centroidsV: Float64Array,
  sign: number,
  bounds: { min: number[]; max: number[] },
  axisU: number,
  axisV: number,
): { u: number; v: number } {
  const n = centroidsU.length;
  let leftIdx = 0, rightIdx = 0, tipIdx = 0;
  for (let t = 1; t < n; t++) {
    if (centroidsU[t]! < centroidsU[leftIdx]!) leftIdx = t;
    if (centroidsU[t]! > centroidsU[rightIdx]!) rightIdx = t;
    if (centroidsV[t]! * sign > centroidsV[tipIdx]! * sign) tipIdx = t;
  }

  const ax = centroidsU[leftIdx]!, ay = centroidsV[leftIdx]!;
  const bx = centroidsU[rightIdx]!, by = centroidsV[rightIdx]!;
  const cx = centroidsU[tipIdx]!, cy = centroidsV[tipIdx]!;

  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  const spanU = bounds.max[axisU]! - bounds.min[axisU]!;
  const spanV = bounds.max[axisV]! - bounds.min[axisV]!;

  const fallback = {
    u: (bounds.min[axisU]! + bounds.max[axisU]!) / 2,
    v: sign === 1 ? bounds.min[axisV]! - spanV : bounds.max[axisV]! + spanV,
  };
  if (Math.abs(d) < 1e-9) return fallback;

  const a2 = ax * ax + ay * ay;
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  const u = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
  const v = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;

  // sanity: radius should be on the order of the arch size
  const r = Math.hypot(ax - u, ay - v);
  const scale = Math.max(spanU, spanV);
  if (!Number.isFinite(r) || r < scale * 0.2 || r > scale * 4) return fallback;
  return { u, v };
}

/** Union-find over welded vertices; returns component id per vertex. */
function connectedComponents(mesh: RawMesh): Int32Array {
  const vertexCount = mesh.positions.length / 3;
  const parent = new Int32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) parent[i] = i;

  const find = (x: number): number => {
    let root = x;
    while (parent[root]! !== root) root = parent[root]!;
    while (parent[x]! !== root) {
      const next = parent[x]!;
      parent[x] = root;
      x = next;
    }
    return root;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let t = 0; t < mesh.indices.length; t += 3) {
    union(mesh.indices[t]!, mesh.indices[t + 1]!);
    union(mesh.indices[t + 1]!, mesh.indices[t + 2]!);
  }

  const componentOf = new Int32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) componentOf[i] = find(i);
  return componentOf;
}

function triangleArea(mesh: RawMesh, t: number): number {
  const p = mesh.positions;
  const a = mesh.indices[t * 3]! * 3, b = mesh.indices[t * 3 + 1]! * 3, c = mesh.indices[t * 3 + 2]! * 3;
  const ax = p[a]!, ay = p[a + 1]!, az = p[a + 2]!;
  const abx = p[b]! - ax, aby = p[b + 1]! - ay, abz = p[b + 2]! - az;
  const acx = p[c]! - ax, acy = p[c + 1]! - ay, acz = p[c + 2]! - az;
  const crx = aby * acz - abz * acy;
  const cry = abz * acx - abx * acz;
  const crz = abx * acy - aby * acx;
  return 0.5 * Math.hypot(crx, cry, crz);
}

function planarAxes(vertical: 0 | 1 | 2): [number, number] {
  if (vertical === 0) return [1, 2];
  if (vertical === 1) return [0, 2];
  return [0, 1];
}

function regionStats(mesh: RawMesh, start: number, count: number) {
  const p = mesh.positions;
  let area = 0;
  let cx = 0, cy = 0, cz = 0;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  for (let t = start; t < start + count; t++) {
    const a = mesh.indices[t * 3]! * 3, b = mesh.indices[t * 3 + 1]! * 3, c = mesh.indices[t * 3 + 2]! * 3;
    const ax = p[a]!, ay = p[a + 1]!, az = p[a + 2]!;
    const bx = p[b]!, by = p[b + 1]!, bz = p[b + 2]!;
    const cxx = p[c]!, cyy = p[c + 1]!, czz = p[c + 2]!;

    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cxx - ax, acy = cyy - ay, acz = czz - az;
    const crx = aby * acz - abz * acy;
    const cry = abz * acx - abx * acz;
    const crz = abx * acy - aby * acx;
    const triArea = 0.5 * Math.hypot(crx, cry, crz);
    area += triArea;

    const tcx = (ax + bx + cxx) / 3, tcy = (ay + by + cyy) / 3, tcz = (az + bz + czz) / 3;
    cx += tcx * triArea; cy += tcy * triArea; cz += tcz * triArea;

    for (const [x, y, z] of [[ax, ay, az], [bx, by, bz], [cxx, cyy, czz]] as const) {
      if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
      if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
      if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
    }
  }

  const w = area > 1e-12 ? area : 1;
  return {
    area,
    centroid: [cx / w, cy / w, cz / w] as [number, number, number],
    boundingBox: { min, max },
  };
}
