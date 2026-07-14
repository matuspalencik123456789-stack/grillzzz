import type { RawMesh } from '../types';

/**
 * PLY parser supporting `ascii 1.0` and `binary_little_endian 1.0` with
 * arbitrary vertex property layouts (x/y/z extracted, rest skipped) and
 * uchar/int list faces. Covers the output of every mainstream dental scanner
 * that emits PLY (3Shape, Medit, iTero exports).
 */

type ScalarType =
  | 'char' | 'uchar' | 'short' | 'ushort' | 'int' | 'uint' | 'float' | 'double'
  | 'int8' | 'uint8' | 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32' | 'float64';

const TYPE_SIZE: Record<string, number> = {
  char: 1, int8: 1, uchar: 1, uint8: 1,
  short: 2, int16: 2, ushort: 2, uint16: 2,
  int: 4, int32: 4, uint: 4, uint32: 4, float: 4, float32: 4,
  double: 8, float64: 8,
};

interface PlyProperty {
  name: string;
  type: ScalarType;
  isList: boolean;
  countType?: ScalarType;
}

interface PlyElement {
  name: string;
  count: number;
  properties: PlyProperty[];
}

export function parsePly(data: Uint8Array): RawMesh {
  const headerEnd = findHeaderEnd(data);
  const headerText = new TextDecoder().decode(data.subarray(0, headerEnd));
  const lines = headerText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines[0] !== 'ply') throw new Error('PLY: missing magic');

  let format: 'ascii' | 'binary_little_endian' | null = null;
  const elements: PlyElement[] = [];

  for (const line of lines.slice(1)) {
    const parts = line.split(/\s+/);
    if (parts[0] === 'format') {
      const f = parts[1];
      if (f !== 'ascii' && f !== 'binary_little_endian') {
        throw new Error(`PLY: unsupported format "${f}"`);
      }
      format = f;
    } else if (parts[0] === 'element') {
      elements.push({ name: parts[1]!, count: Number(parts[2]), properties: [] });
    } else if (parts[0] === 'property') {
      const el = elements[elements.length - 1];
      if (!el) throw new Error('PLY: property before element');
      if (parts[1] === 'list') {
        el.properties.push({
          name: parts[4]!,
          type: parts[3] as ScalarType,
          isList: true,
          countType: parts[2] as ScalarType,
        });
      } else {
        el.properties.push({ name: parts[2]!, type: parts[1] as ScalarType, isList: false });
      }
    }
  }
  if (!format) throw new Error('PLY: missing format line');

  const body = data.subarray(headerEnd);
  return format === 'ascii' ? parseAsciiBody(body, elements) : parseBinaryBody(body, elements);
}

function findHeaderEnd(data: Uint8Array): number {
  const needle = 'end_header';
  const text = new TextDecoder().decode(data.subarray(0, Math.min(data.length, 65536)));
  const idx = text.indexOf(needle);
  if (idx < 0) throw new Error('PLY: end_header not found');
  // consume trailing newline
  let end = idx + needle.length;
  while (end < text.length && (text[end] === '\r' || text[end] === '\n')) {
    end++;
    if (text[end - 1] === '\n') break;
  }
  return end;
}

function extract(elements: PlyElement[], name: string): PlyElement {
  const el = elements.find((e) => e.name === name);
  if (!el) throw new Error(`PLY: missing element "${name}"`);
  return el;
}

function parseAsciiBody(body: Uint8Array, elements: PlyElement[]): RawMesh {
  const tokens = new TextDecoder().decode(body).split(/\s+/).filter(Boolean);
  let cursor = 0;
  const next = () => {
    const t = tokens[cursor++];
    if (t === undefined) throw new Error('PLY: unexpected end of ASCII body');
    return Number(t);
  };

  let positions: Float32Array | null = null;
  const indices: number[] = [];

  for (const el of elements) {
    if (el.name === 'vertex') {
      positions = new Float32Array(el.count * 3);
      const xi = el.properties.findIndex((p) => p.name === 'x');
      for (let v = 0; v < el.count; v++) {
        for (let p = 0; p < el.properties.length; p++) {
          const value = next();
          if (p === xi) positions[v * 3] = value;
          else if (p === xi + 1) positions[v * 3 + 1] = value;
          else if (p === xi + 2) positions[v * 3 + 2] = value;
        }
      }
    } else if (el.name === 'face') {
      for (let f = 0; f < el.count; f++) {
        for (const prop of el.properties) {
          if (prop.isList) {
            const n = next();
            const face: number[] = [];
            for (let i = 0; i < n; i++) face.push(next());
            for (let i = 1; i < face.length - 1; i++) {
              indices.push(face[0]!, face[i]!, face[i + 1]!);
            }
          } else {
            next();
          }
        }
      }
    } else {
      // skip unknown elements (assumes non-list scalar rows)
      for (let i = 0; i < el.count; i++) for (const _p of el.properties) next();
    }
  }

  if (!positions) throw new Error('PLY: no vertex element');
  return { positions, indices: new Uint32Array(indices) };
}

function parseBinaryBody(body: Uint8Array, elements: PlyElement[]): RawMesh {
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let offset = 0;

  const readScalar = (type: ScalarType): number => {
    const size = TYPE_SIZE[type];
    if (!size) throw new Error(`PLY: unknown type "${type}"`);
    let value: number;
    switch (type) {
      case 'char': case 'int8': value = view.getInt8(offset); break;
      case 'uchar': case 'uint8': value = view.getUint8(offset); break;
      case 'short': case 'int16': value = view.getInt16(offset, true); break;
      case 'ushort': case 'uint16': value = view.getUint16(offset, true); break;
      case 'int': case 'int32': value = view.getInt32(offset, true); break;
      case 'uint': case 'uint32': value = view.getUint32(offset, true); break;
      case 'float': case 'float32': value = view.getFloat32(offset, true); break;
      case 'double': case 'float64': value = view.getFloat64(offset, true); break;
      default: throw new Error(`PLY: unknown type "${type}"`);
    }
    offset += size;
    return value;
  };

  let positions: Float32Array | null = null;
  const indices: number[] = [];

  for (const el of elements) {
    if (el.name === 'vertex') {
      positions = new Float32Array(el.count * 3);
      for (let v = 0; v < el.count; v++) {
        for (const prop of el.properties) {
          const value = readScalar(prop.type);
          if (prop.name === 'x') positions[v * 3] = value;
          else if (prop.name === 'y') positions[v * 3 + 1] = value;
          else if (prop.name === 'z') positions[v * 3 + 2] = value;
        }
      }
    } else if (el.name === 'face') {
      for (let f = 0; f < el.count; f++) {
        for (const prop of el.properties) {
          if (prop.isList) {
            const n = readScalar(prop.countType!);
            const face: number[] = [];
            for (let i = 0; i < n; i++) face.push(readScalar(prop.type));
            for (let i = 1; i < face.length - 1; i++) {
              indices.push(face[0]!, face[i]!, face[i + 1]!);
            }
          } else {
            readScalar(prop.type);
          }
        }
      }
    } else {
      for (let i = 0; i < el.count; i++) {
        for (const prop of el.properties) {
          if (prop.isList) {
            const n = readScalar(prop.countType!);
            for (let j = 0; j < n; j++) readScalar(prop.type);
          } else {
            readScalar(prop.type);
          }
        }
      }
    }
  }

  if (!positions) throw new Error('PLY: no vertex element');
  return { positions, indices: new Uint32Array(indices) };
}
