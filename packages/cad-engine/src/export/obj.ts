import type { RawMesh } from '../types';

export function exportObj(mesh: RawMesh, name = 'grillz'): Uint8Array {
  const parts: string[] = [`# Grillz Studio export\no ${name}\n`];
  const p = mesh.positions;
  for (let v = 0; v < p.length; v += 3) {
    parts.push(`v ${fmt(p[v]!)} ${fmt(p[v + 1]!)} ${fmt(p[v + 2]!)}\n`);
  }
  if (mesh.normals) {
    const n = mesh.normals;
    for (let v = 0; v < n.length; v += 3) {
      parts.push(`vn ${fmt(n[v]!)} ${fmt(n[v + 1]!)} ${fmt(n[v + 2]!)}\n`);
    }
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const a = mesh.indices[t]! + 1, b = mesh.indices[t + 1]! + 1, c = mesh.indices[t + 2]! + 1;
      parts.push(`f ${a}//${a} ${b}//${b} ${c}//${c}\n`);
    }
  } else {
    for (let t = 0; t < mesh.indices.length; t += 3) {
      parts.push(`f ${mesh.indices[t]! + 1} ${mesh.indices[t + 1]! + 1} ${mesh.indices[t + 2]! + 1}\n`);
    }
  }
  return new TextEncoder().encode(parts.join(''));
}

function fmt(n: number): string {
  return Number.isInteger(n) ? n.toFixed(1) : n.toPrecision(7).replace(/0+$/, '').replace(/\.$/, '.0');
}
