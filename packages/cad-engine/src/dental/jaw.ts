import type { JawKind } from '@grillz/shared-types';
import type { RawMesh } from '../types';
import { computeBounds } from '../transform';

export interface JawDetection {
  jaw: JawKind;
  confidence: number;
  verticalAxis: 0 | 1 | 2;
  /** +1 if crowns point toward +axis, -1 otherwise */
  crownDirection: 1 | -1;
}

/**
 * Geometric jaw heuristic.
 *
 * 1. The vertical axis of a single-arch scan is the bounding-box axis with the
 *    smallest extent (arches are wide and deep but shallow).
 * 2. Crowns carry far more surface detail than the gingival/base side, so the
 *    half-space along the vertical axis with the higher triangle density is
 *    the occlusal side.
 * 3. Scanners export upper jaws occlusal-side "down" in scan space and lower
 *    jaws occlusal-side "up" far more often than not; when a `hint` is
 *    supplied by the user it always wins.
 *
 * This is deliberately behind a small interface: an ML classifier can replace
 * the body without touching any caller.
 */
export function detectJaw(mesh: RawMesh, hint?: JawKind): JawDetection {
  const bounds = computeBounds(mesh);
  const spans = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ] as const;

  let verticalAxis: 0 | 1 | 2 = 0;
  if (spans[1] <= spans[0] && spans[1] <= spans[2]) verticalAxis = 1;
  else if (spans[2] <= spans[0] && spans[2] <= spans[1]) verticalAxis = 2;

  const mid = (bounds.min[verticalAxis]! + bounds.max[verticalAxis]!) / 2;
  let above = 0;
  let below = 0;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t]!, b = mesh.indices[t + 1]!, c = mesh.indices[t + 2]!;
    const centroid =
      (mesh.positions[a * 3 + verticalAxis]! +
        mesh.positions[b * 3 + verticalAxis]! +
        mesh.positions[c * 3 + verticalAxis]!) /
      3;
    if (centroid > mid) above++;
    else below++;
  }

  const total = above + below;
  const crownDirection: 1 | -1 = above >= below ? 1 : -1;
  const asymmetry = total === 0 ? 0 : Math.abs(above - below) / total;

  if (hint && hint !== 'UNKNOWN') {
    return { jaw: hint, confidence: 1, verticalAxis, crownDirection };
  }

  // crowns-up ⇒ lower jaw scan orientation convention
  const jaw: JawKind = crownDirection === 1 ? 'LOWER' : 'UPPER';
  // asymmetry of detail is a weak signal; report it honestly
  const confidence = Math.min(0.9, 0.5 + asymmetry);
  return { jaw, confidence, verticalAxis, crownDirection };
}
