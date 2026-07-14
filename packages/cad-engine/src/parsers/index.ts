import type { ScanFormat } from '@grillz/shared-types';
import type { RawMesh } from '../types';
import { parseStl } from './stl';
import { parseObj } from './obj';
import { parsePly } from './ply';
import { parseGlb } from './glb';

export { parseStl } from './stl';
export { parseObj } from './obj';
export { parsePly } from './ply';
export { parseGlb } from './glb';

/** Magic-byte sniffing — never trust the file extension alone. */
export function sniffFormat(data: Uint8Array): ScanFormat | null {
  if (data.length < 8) return null;
  const head = new TextDecoder().decode(data.subarray(0, 128));
  if (data[0] === 0x67 && data[1] === 0x6c && data[2] === 0x54 && data[3] === 0x46) return 'GLB'; // "glTF"
  if (head.startsWith('ply')) return 'PLY';
  if (head.trimStart().startsWith('{')) return 'GLTF';
  if (head.trimStart().startsWith('solid')) return 'STL';
  if (/^(#|v\s|vn\s|o\s|mtllib\s)/m.test(head)) return 'OBJ';
  // binary STL: size invariant check
  if (data.length >= 84) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const triCount = view.getUint32(80, true);
    if (data.length === 84 + triCount * 50) return 'STL';
  }
  return null;
}

export function parseMesh(data: Uint8Array, declaredFormat: ScanFormat): RawMesh {
  const sniffed = sniffFormat(data);
  const format = sniffed ?? declaredFormat;
  if (sniffed && sniffed !== declaredFormat) {
    // Tolerate STL declared/ascii-solid ambiguity, reject outright mismatch of family
    const compatible =
      (sniffed === 'GLB' && declaredFormat === 'GLTF') ||
      (sniffed === 'GLTF' && declaredFormat === 'GLB') ||
      sniffed === declaredFormat;
    if (!compatible && declaredFormat !== 'STL') {
      throw new Error(`File content is ${sniffed}, not the declared ${declaredFormat}`);
    }
  }
  switch (format) {
    case 'STL':
      return parseStl(data);
    case 'OBJ':
      return parseObj(data);
    case 'PLY':
      return parsePly(data);
    case 'GLB':
    case 'GLTF':
      return parseGlb(data);
    default:
      throw new Error(`Unsupported format ${String(format)}`);
  }
}
