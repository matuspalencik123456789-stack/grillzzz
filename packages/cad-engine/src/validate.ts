import type { MeshValidationIssue, MeshValidationResult, RawMesh } from './types';
import { computeBounds } from './transform';

/**
 * Structural validation run before any processing. ERRORs abort the pipeline;
 * WARNINGs are surfaced to the user but processing continues (dental scans
 * are open shells, so non-watertight is expected and only a warning).
 */
export function validateMesh(mesh: RawMesh): MeshValidationResult {
  const issues: MeshValidationIssue[] = [];

  if (mesh.positions.length === 0 || mesh.indices.length === 0) {
    issues.push({ code: 'EMPTY_MESH', severity: 'ERROR', message: 'Mesh contains no geometry' });
    return { ok: false, issues };
  }
  if (mesh.positions.length % 3 !== 0 || mesh.indices.length % 3 !== 0) {
    issues.push({
      code: 'EMPTY_MESH',
      severity: 'ERROR',
      message: 'Malformed buffers: position/index counts are not multiples of 3',
    });
    return { ok: false, issues };
  }

  let nonFinite = 0;
  for (let i = 0; i < mesh.positions.length; i++) {
    if (!Number.isFinite(mesh.positions[i])) nonFinite++;
  }
  if (nonFinite > 0) {
    issues.push({
      code: 'NON_FINITE_VERTEX',
      severity: 'ERROR',
      message: `${nonFinite} non-finite vertex components (NaN/Infinity)`,
      count: nonFinite,
    });
  }

  const vertexCount = mesh.positions.length / 3;
  let outOfRange = 0;
  for (let i = 0; i < mesh.indices.length; i++) {
    if (mesh.indices[i]! >= vertexCount) outOfRange++;
  }
  if (outOfRange > 0) {
    issues.push({
      code: 'INDEX_OUT_OF_RANGE',
      severity: 'ERROR',
      message: `${outOfRange} indices reference missing vertices`,
      count: outOfRange,
    });
  }

  if (issues.some((i) => i.severity === 'ERROR')) return { ok: false, issues };

  let degenerate = 0;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t]!;
    const b = mesh.indices[t + 1]!;
    const c = mesh.indices[t + 2]!;
    if (a === b || b === c || a === c || triangleAreaSq(mesh, a, b, c) < 1e-16) degenerate++;
  }
  if (degenerate > 0) {
    issues.push({
      code: 'DEGENERATE_TRIANGLE',
      severity: 'WARNING',
      message: `${degenerate} degenerate triangles (removed during optimization)`,
      count: degenerate,
    });
  }

  // Plausibility: a dental arch is 30–80 mm across. Scans in metres or microns
  // indicate wrong units; we warn (the pipeline auto-rescales obvious cases).
  const bounds = computeBounds(mesh);
  const spans = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
  const maxSpan = Math.max(...spans);
  if (maxSpan < 1 || maxSpan > 1000) {
    issues.push({
      code: 'IMPLAUSIBLE_SCALE',
      severity: 'WARNING',
      message: `Largest extent is ${maxSpan.toFixed(3)} mm — expected 30–120 mm for a dental scan`,
    });
  }

  return { ok: true, issues };
}

function triangleAreaSq(mesh: RawMesh, a: number, b: number, c: number): number {
  const p = mesh.positions;
  const ax = p[a * 3]!, ay = p[a * 3 + 1]!, az = p[a * 3 + 2]!;
  const abx = p[b * 3]! - ax, aby = p[b * 3 + 1]! - ay, abz = p[b * 3 + 2]! - az;
  const acx = p[c * 3]! - ax, acy = p[c * 3 + 1]! - ay, acz = p[c * 3 + 2]! - az;
  const cx = aby * acz - abz * acy;
  const cy = abz * acx - abx * acz;
  const cz = abx * acy - aby * acx;
  return 0.25 * (cx * cx + cy * cy + cz * cz);
}
