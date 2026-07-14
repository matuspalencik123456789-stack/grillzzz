import type { RawMesh } from '@grillz/cad-engine';
import { computeBounds, computeVertexNormals } from '@grillz/cad-engine';
import { encodePng } from './png';

export interface RasterizeOptions {
  width?: number;
  height?: number;
  /** '#rrggbb' object color */
  colorHex?: string;
  /** '#rrggbb' background; alpha 0 when omitted */
  backgroundHex?: string;
}

/**
 * Software thumbnail renderer: orthographic 3/4 view, z-buffered triangle
 * rasterization, Lambert + rim shading. Deliberately dependency-free so scan
 * workers run on plain Node containers without GPUs or native modules.
 */
export function renderMeshThumbnail(mesh: RawMesh, options: RasterizeOptions = {}): Uint8Array {
  const width = options.width ?? 512;
  const height = options.height ?? 512;
  const color = hexToRgb(options.colorHex ?? '#e3bd58');
  const background = options.backgroundHex ? hexToRgb(options.backgroundHex) : null;

  const withNormals = mesh.normals ? mesh : computeVertexNormals(mesh);
  const { positions, indices } = withNormals;
  const normals = withNormals.normals!;

  // 3/4 view: rotate -25° about X then 30° about Y, then orthographic XY
  const rotation = multiply3(rotationX(-0.4363), rotationY(0.5236));

  const vertexCount = positions.length / 3;
  const transformed = new Float32Array(vertexCount * 3);
  const transformedNormals = new Float32Array(vertexCount * 3);
  for (let v = 0; v < vertexCount; v++) {
    applyMat3(rotation, positions, v, transformed);
    applyMat3(rotation, normals, v, transformedNormals);
  }

  const bounds = computeBounds({ positions: transformed, indices });
  const spanX = bounds.max[0] - bounds.min[0] || 1;
  const spanY = bounds.max[1] - bounds.min[1] || 1;
  const scale = 0.86 * Math.min(width / spanX, height / spanY);
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerY = (bounds.min[1] + bounds.max[1]) / 2;

  const toScreenX = (x: number) => (x - centerX) * scale + width / 2;
  const toScreenY = (y: number) => height / 2 - (y - centerY) * scale;

  const rgba = new Uint8Array(width * height * 4);
  if (background) {
    for (let i = 0; i < width * height; i++) {
      rgba[i * 4] = background[0];
      rgba[i * 4 + 1] = background[1];
      rgba[i * 4 + 2] = background[2];
      rgba[i * 4 + 3] = 255;
    }
  }
  const depth = new Float32Array(width * height).fill(-Infinity);

  const light = normalize([-0.4, 0.7, 0.6]);

  for (let t = 0; t < indices.length; t += 3) {
    const i0 = indices[t]!, i1 = indices[t + 1]!, i2 = indices[t + 2]!;
    const x0 = toScreenX(transformed[i0 * 3]!), y0 = toScreenY(transformed[i0 * 3 + 1]!), z0 = transformed[i0 * 3 + 2]!;
    const x1 = toScreenX(transformed[i1 * 3]!), y1 = toScreenY(transformed[i1 * 3 + 1]!), z1 = transformed[i1 * 3 + 2]!;
    const x2 = toScreenX(transformed[i2 * 3]!), y2 = toScreenY(transformed[i2 * 3 + 1]!), z2 = transformed[i2 * 3 + 2]!;

    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const maxX = Math.min(width - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const maxY = Math.min(height - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (minX > maxX || minY > maxY) continue;

    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < 1e-9) continue;
    const invArea = 1 / area;

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * invArea;
        const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * invArea;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;

        const z = w0 * z0 + w1 * z1 + w2 * z2;
        const idx = py * width + px;
        if (z <= depth[idx]!) continue;
        depth[idx] = z;

        // interpolated normal (view space; camera looks down -Z after rotation)
        let nx = w0 * transformedNormals[i0 * 3]! + w1 * transformedNormals[i1 * 3]! + w2 * transformedNormals[i2 * 3]!;
        let ny = w0 * transformedNormals[i0 * 3 + 1]! + w1 * transformedNormals[i1 * 3 + 1]! + w2 * transformedNormals[i2 * 3 + 1]!;
        let nz = w0 * transformedNormals[i0 * 3 + 2]! + w1 * transformedNormals[i1 * 3 + 2]! + w2 * transformedNormals[i2 * 3 + 2]!;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len; ny /= len; nz /= len;
        if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; } // double-sided

        const lambert = Math.max(0, nx * light[0]! + ny * light[1]! + nz * light[2]!);
        const rim = Math.pow(1 - Math.max(0, nz), 2) * 0.35; // metallic rim
        const shade = 0.18 + 0.72 * lambert + rim;

        rgba[idx * 4] = Math.min(255, Math.round(color[0] * shade));
        rgba[idx * 4 + 1] = Math.min(255, Math.round(color[1] * shade));
        rgba[idx * 4 + 2] = Math.min(255, Math.round(color[2] * shade));
        rgba[idx * 4 + 3] = 255;
      }
    }
  }

  return encodePng(width, height, rgba);
}

type Mat3 = [number, number, number, number, number, number, number, number, number];

function rotationX(rad: number): Mat3 {
  const c = Math.cos(rad), s = Math.sin(rad);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
function rotationY(rad: number): Mat3 {
  const c = Math.cos(rad), s = Math.sin(rad);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
function multiply3(a: Mat3, b: Mat3): Mat3 {
  const out = new Array(9).fill(0) as Mat3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!;
    }
  }
  return out;
}
function applyMat3(m: Mat3, src: Float32Array, vertex: number, dst: Float32Array): void {
  const x = src[vertex * 3]!, y = src[vertex * 3 + 1]!, z = src[vertex * 3 + 2]!;
  dst[vertex * 3] = m[0] * x + m[1] * y + m[2] * z;
  dst[vertex * 3 + 1] = m[3] * x + m[4] * y + m[5] * z;
  dst[vertex * 3 + 2] = m[6] * x + m[7] * y + m[8] * z;
}
function normalize(v: number[]): number[] {
  const len = Math.hypot(v[0]!, v[1]!, v[2]!) || 1;
  return [v[0]! / len, v[1]! / len, v[2]! / len];
}
function hexToRgb(hex: string): [number, number, number] {
  const int = parseInt(hex.replace('#', ''), 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
