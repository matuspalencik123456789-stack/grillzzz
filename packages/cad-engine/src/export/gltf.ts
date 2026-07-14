import type { RawMesh } from '../types';
import { computeBounds } from '../transform';
import { computeVertexNormals } from '../normals';

export interface GltfExportOptions {
  name?: string;
  /** PBR material baked into the file for standalone viewers */
  baseColorHex?: string; // "#rrggbb"
  metallic?: number;
  roughness?: number;
}

/**
 * Self-contained GLB (glTF 2.0 binary) writer: one mesh, one PBR material,
 * positions + normals + uint32 indices. This is the interchange format the
 * frontend viewer streams and the format we hand to customers.
 */
export function exportGlb(mesh: RawMesh, options: GltfExportOptions = {}): Uint8Array {
  const withNormals = mesh.normals ? mesh : computeVertexNormals(mesh);
  const positions = withNormals.positions;
  const normals = withNormals.normals!;
  const indices = withNormals.indices;
  const bounds = computeBounds(withNormals);

  // binary layout: indices | positions | normals (each 4-byte aligned)
  const idxBytes = indices.byteLength;
  const posOffset = align4(idxBytes);
  const norOffset = align4(posOffset + positions.byteLength);
  const binLength = align4(norOffset + normals.byteLength);

  const bin = new Uint8Array(binLength);
  bin.set(new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength), 0);
  bin.set(new Uint8Array(positions.buffer, positions.byteOffset, positions.byteLength), posOffset);
  bin.set(new Uint8Array(normals.buffer, normals.byteOffset, normals.byteLength), norOffset);

  const color = hexToRgb(options.baseColorHex ?? '#e3bd58');

  const gltf = {
    asset: { version: '2.0', generator: 'grillz-studio/cad-engine' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: options.name ?? 'grillz' }],
    meshes: [
      {
        name: options.name ?? 'grillz',
        primitives: [
          { attributes: { POSITION: 1, NORMAL: 2 }, indices: 0, material: 0, mode: 4 },
        ],
      },
    ],
    materials: [
      {
        name: 'metal',
        pbrMetallicRoughness: {
          baseColorFactor: [...color, 1],
          metallicFactor: options.metallic ?? 1,
          roughnessFactor: options.roughness ?? 0.15,
        },
      },
    ],
    buffers: [{ byteLength: binLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: idxBytes, target: 34963 },
      { buffer: 0, byteOffset: posOffset, byteLength: positions.byteLength, target: 34962 },
      { buffer: 0, byteOffset: norOffset, byteLength: normals.byteLength, target: 34962 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5125, count: indices.length, type: 'SCALAR' },
      {
        bufferView: 1,
        componentType: 5126,
        count: positions.length / 3,
        type: 'VEC3',
        min: bounds.min,
        max: bounds.max,
      },
      { bufferView: 2, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
    ],
  };

  let jsonBytes = new TextEncoder().encode(JSON.stringify(gltf));
  const jsonPad = align4(jsonBytes.length) - jsonBytes.length;
  if (jsonPad > 0) {
    const padded = new Uint8Array(jsonBytes.length + jsonPad);
    padded.set(jsonBytes);
    padded.fill(0x20, jsonBytes.length); // JSON chunks pad with spaces
    jsonBytes = padded;
  }

  const total = 12 + 8 + jsonBytes.length + 8 + binLength;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true); // "glTF"
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true); // "JSON"
  out.set(jsonBytes, 20);
  const binChunkStart = 20 + jsonBytes.length;
  view.setUint32(binChunkStart, binLength, true);
  view.setUint32(binChunkStart + 4, 0x004e4942, true); // "BIN"
  out.set(bin, binChunkStart + 8);
  return out;
}

function align4(n: number): number {
  return (n + 3) & ~3;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const int = parseInt(h, 16);
  // sRGB → linear approximation for baseColorFactor
  const srgb = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((v) => v / 255);
  return srgb.map((c) => Math.pow(c, 2.2)) as [number, number, number];
}
