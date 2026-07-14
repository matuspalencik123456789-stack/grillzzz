import type { RawMesh } from '../types';

/**
 * Minimal glTF 2.0 reader for scan intake: extracts POSITION + indices of all
 * triangle primitives from a GLB container or embedded-buffer .gltf JSON.
 * External .bin references are rejected (uploads are single-file).
 */

interface GltfJson {
  buffers?: Array<{ uri?: string; byteLength: number }>;
  bufferViews?: Array<{ buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }>;
  accessors?: Array<{
    bufferView?: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    type: string;
  }>;
  meshes?: Array<{ primitives: Array<{ attributes: Record<string, number>; indices?: number; mode?: number }> }>;
}

const COMPONENT_SIZE: Record<number, number> = {
  5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4,
};
const TYPE_COMPONENTS: Record<string, number> = {
  SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4,
};

export function parseGlb(data: Uint8Array): RawMesh {
  let json: GltfJson;
  let bin: Uint8Array | null = null;

  if (data[0] === 0x67 && data[1] === 0x6c && data[2] === 0x54 && data[3] === 0x46) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const version = view.getUint32(4, true);
    if (version !== 2) throw new Error(`GLB: unsupported version ${version}`);
    let offset = 12;
    let jsonText: string | null = null;
    while (offset + 8 <= data.length) {
      const chunkLen = view.getUint32(offset, true);
      const chunkType = view.getUint32(offset + 4, true);
      const chunk = data.subarray(offset + 8, offset + 8 + chunkLen);
      if (chunkType === 0x4e4f534a) jsonText = new TextDecoder().decode(chunk); // JSON
      else if (chunkType === 0x004e4942) bin = chunk; // BIN
      // Spec-compliant writers pad chunkData and include padding in chunkLen;
      // align up defensively for writers that don't.
      offset = (offset + 8 + chunkLen + 3) & ~3;
    }
    if (!jsonText) throw new Error('GLB: missing JSON chunk');
    json = JSON.parse(jsonText) as GltfJson;
  } else {
    json = JSON.parse(new TextDecoder().decode(data)) as GltfJson;
    const buffer = json.buffers?.[0];
    if (buffer?.uri?.startsWith('data:')) {
      const base64 = buffer.uri.slice(buffer.uri.indexOf(',') + 1);
      bin = base64Decode(base64);
    } else if (buffer?.uri) {
      throw new Error('glTF: external buffer references are not supported for uploads');
    }
  }

  if (!bin) throw new Error('glTF: no binary buffer available');
  if (!json.meshes?.length) throw new Error('glTF: no meshes');

  const positionsParts: Float32Array[] = [];
  const indicesParts: Uint32Array[] = [];
  let vertexBase = 0;

  for (const mesh of json.meshes) {
    for (const prim of mesh.primitives) {
      if (prim.mode !== undefined && prim.mode !== 4) continue; // triangles only
      const posAccessorIdx = prim.attributes['POSITION'];
      if (posAccessorIdx === undefined) continue;
      const pos = readAccessor(json, bin, posAccessorIdx);
      const positions = new Float32Array(pos);
      positionsParts.push(positions);

      const vCount = positions.length / 3;
      if (prim.indices !== undefined) {
        const idx = readAccessor(json, bin, prim.indices);
        const indices = new Uint32Array(idx.length);
        for (let i = 0; i < idx.length; i++) indices[i] = idx[i]! + vertexBase;
        indicesParts.push(indices);
      } else {
        const indices = new Uint32Array(vCount);
        for (let i = 0; i < vCount; i++) indices[i] = vertexBase + i;
        indicesParts.push(indices);
      }
      vertexBase += vCount;
    }
  }

  const totalPos = positionsParts.reduce((s, a) => s + a.length, 0);
  const totalIdx = indicesParts.reduce((s, a) => s + a.length, 0);
  if (totalPos === 0 || totalIdx === 0) throw new Error('glTF: no triangle geometry found');

  const positions = new Float32Array(totalPos);
  const indices = new Uint32Array(totalIdx);
  let po = 0;
  for (const part of positionsParts) { positions.set(part, po); po += part.length; }
  let io = 0;
  for (const part of indicesParts) { indices.set(part, io); io += part.length; }
  return { positions, indices };
}

function readAccessor(json: GltfJson, bin: Uint8Array, accessorIdx: number): number[] {
  const accessor = json.accessors?.[accessorIdx];
  if (!accessor) throw new Error(`glTF: missing accessor ${accessorIdx}`);
  if (accessor.bufferView === undefined) throw new Error('glTF: sparse accessors unsupported');
  const bv = json.bufferViews?.[accessor.bufferView];
  if (!bv) throw new Error(`glTF: missing bufferView ${accessor.bufferView}`);

  const compSize = COMPONENT_SIZE[accessor.componentType];
  const compCount = TYPE_COMPONENTS[accessor.type];
  if (!compSize || !compCount) throw new Error('glTF: unsupported accessor layout');

  const start = (bv.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = bv.byteStride ?? compSize * compCount;
  const view = new DataView(bin.buffer, bin.byteOffset + start);

  const out: number[] = new Array(accessor.count * compCount);
  for (let i = 0; i < accessor.count; i++) {
    for (let c = 0; c < compCount; c++) {
      const byteOffset = i * stride + c * compSize;
      switch (accessor.componentType) {
        case 5120: out[i * compCount + c] = view.getInt8(byteOffset); break;
        case 5121: out[i * compCount + c] = view.getUint8(byteOffset); break;
        case 5122: out[i * compCount + c] = view.getInt16(byteOffset, true); break;
        case 5123: out[i * compCount + c] = view.getUint16(byteOffset, true); break;
        case 5125: out[i * compCount + c] = view.getUint32(byteOffset, true); break;
        case 5126: out[i * compCount + c] = view.getFloat32(byteOffset, true); break;
        default: throw new Error(`glTF: unsupported componentType ${accessor.componentType}`);
      }
    }
  }
  return out;
}

function base64Decode(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(base64, 'base64'));
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
