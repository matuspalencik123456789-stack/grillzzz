import type { RawMesh } from './types';

export interface SyntheticArchOptions {
  toothCount?: number;
  archRadiusMm?: number;
  toothWidthMm?: number;
  toothHeightMm?: number;
  toothDepthMm?: number;
  /** subdivisions per tooth face — raises triangle counts for perf tests */
  detail?: number;
}

/**
 * Synthetic dental arch: N box-teeth placed along a semicircle in the XZ
 * plane, crowns pointing +Y. Used by unit tests (segmentation must recover
 * the teeth) and by local dev when no real scan is at hand.
 */
export function generateSyntheticArch(options: SyntheticArchOptions = {}): RawMesh {
  const toothCount = options.toothCount ?? 16;
  const radius = options.archRadiusMm ?? 24;
  const height = options.toothHeightMm ?? 9;
  const depth = options.toothDepthMm ?? 6;
  // real scans are dense (50k–500k triangles); default detail keeps the
  // area-density histogram continuous the way real data is
  const detail = Math.max(1, options.detail ?? 3);

  const positions: number[] = [];
  const indices: number[] = [];

  // A full 16-tooth arch spans a semicircle; a partial scan spans a
  // proportionally smaller arc centered on the anterior midline, matching how
  // anterior-only dental scans actually look.
  const arcSpan = (toothCount / 16) * Math.PI;
  const arcStart = Math.PI / 2 + arcSpan / 2;

  // teeth must not interpenetrate: cap width at 75% of neighbor chord spacing
  const chord =
    toothCount > 1 ? 2 * radius * Math.sin(arcSpan / (2 * (toothCount - 1))) : Infinity;
  const width = Math.min(options.toothWidthMm ?? 7, chord * 0.75);

  for (let i = 0; i < toothCount; i++) {
    const t = toothCount === 1 ? 0.5 : i / (toothCount - 1);
    const angle = arcStart - t * arcSpan;
    const cx = Math.cos(angle) * radius;
    const cz = Math.sin(angle) * radius;
    appendBox(positions, indices, cx, 0, cz, width, height, depth, angle, detail);
  }

  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

function appendBox(
  positions: number[],
  indices: number[],
  cx: number,
  cy: number,
  cz: number,
  w: number,
  h: number,
  d: number,
  yaw: number,
  detail: number,
): void {
  const base = positions.length / 3;
  const cosY = Math.cos(yaw + Math.PI / 2);
  const sinY = Math.sin(yaw + Math.PI / 2);

  // grid-subdivided box: 6 faces × detail² quads × 2 triangles
  const faces: Array<{ origin: [number, number, number]; du: [number, number, number]; dv: [number, number, number] }> = [
    { origin: [-w / 2, -h / 2, d / 2], du: [w, 0, 0], dv: [0, h, 0] }, // front
    { origin: [w / 2, -h / 2, -d / 2], du: [-w, 0, 0], dv: [0, h, 0] }, // back
    { origin: [-w / 2, -h / 2, -d / 2], du: [0, 0, d], dv: [0, h, 0] }, // left
    { origin: [w / 2, -h / 2, d / 2], du: [0, 0, -d], dv: [0, h, 0] }, // right
    { origin: [-w / 2, h / 2, d / 2], du: [w, 0, 0], dv: [0, 0, -d] }, // top (crown)
    { origin: [-w / 2, -h / 2, -d / 2], du: [w, 0, 0], dv: [0, 0, d] }, // bottom
  ];

  for (const face of faces) {
    const faceBase = positions.length / 3;
    for (let v = 0; v <= detail; v++) {
      for (let u = 0; u <= detail; u++) {
        const fu = u / detail;
        const fv = v / detail;
        const lx = face.origin[0] + face.du[0] * fu + face.dv[0] * fv;
        const ly = face.origin[1] + face.du[1] * fu + face.dv[1] * fv;
        const lz = face.origin[2] + face.du[2] * fu + face.dv[2] * fv;
        // yaw the tooth to face outward from the arch, then translate
        const wx = lx * cosY - lz * sinY + cx;
        const wz = lx * sinY + lz * cosY + cz;
        positions.push(wx, ly + cy, wz);
      }
    }
    for (let v = 0; v < detail; v++) {
      for (let u = 0; u < detail; u++) {
        const a = faceBase + v * (detail + 1) + u;
        const b = a + 1;
        const c = a + detail + 1;
        const dIdx = c + 1;
        indices.push(a, b, dIdx, a, dIdx, c);
      }
    }
  }
  void base;
}
