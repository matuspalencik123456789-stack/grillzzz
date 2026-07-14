import { describe, expect, it } from 'vitest';
import { generateSyntheticArch } from './synthetic';
import { exportStl } from './export/stl';
import { exportObj } from './export/obj';
import { exportGlb } from './export/gltf';
import { parseStl } from './parsers/stl';
import { parseObj } from './parsers/obj';
import { parsePly } from './parsers/ply';
import { parseGlb } from './parsers/glb';
import { sniffFormat } from './parsers';
import { validateMesh } from './validate';
import { optimizeMesh } from './optimize';
import { centerMesh, computeBounds, normalizeUnitsToMm } from './transform';
import { computeVertexNormals } from './normals';
import { analyzeMesh } from './analyze';
import { detectJaw } from './dental/jaw';
import { ArchToothSegmenter } from './dental/segmentation';
import { processScan } from './pipeline';
import type { RawMesh } from './types';

function unitCube(): RawMesh {
  // 8 vertices, 12 triangles, watertight, volume 1
  const positions = new Float32Array([
    0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0,
    0, 0, 1,  1, 0, 1,  1, 1, 1,  0, 1, 1,
  ]);
  const indices = new Uint32Array([
    0, 2, 1, 0, 3, 2, // z=0 (outward -z)
    4, 5, 6, 4, 6, 7, // z=1
    0, 1, 5, 0, 5, 4, // y=0
    3, 6, 2, 3, 7, 6, // y=1
    0, 4, 7, 0, 7, 3, // x=0
    1, 2, 6, 1, 6, 5, // x=1
  ]);
  return { positions, indices };
}

describe('analyzeMesh', () => {
  it('computes exact area and volume of a unit cube', () => {
    const analysis = analyzeMesh(unitCube());
    expect(analysis.surfaceAreaMm2).toBeCloseTo(6, 6);
    expect(analysis.volumeMm3).toBeCloseTo(1, 6);
    expect(analysis.watertight).toBe(true);
    expect(analysis.triangleCount).toBe(12);
  });

  it('detects open meshes as non-watertight', () => {
    const cube = unitCube();
    const open: RawMesh = { positions: cube.positions, indices: cube.indices.slice(0, 33) };
    expect(analyzeMesh(open).watertight).toBe(false);
  });
});

describe('STL round trip', () => {
  it('binary export → parse preserves geometry', () => {
    const arch = generateSyntheticArch({ toothCount: 4 });
    const stl = exportStl(arch);
    const parsed = parseStl(stl);
    expect(parsed.indices.length).toBe(arch.indices.length);
    const before = analyzeMesh(optimizeMesh(arch));
    const after = analyzeMesh(optimizeMesh(parsed));
    expect(after.surfaceAreaMm2).toBeCloseTo(before.surfaceAreaMm2, 2);
    expect(after.volumeMm3).toBeCloseTo(before.volumeMm3, 1);
  });

  it('parses ASCII STL', () => {
    const ascii = `solid test
facet normal 0 0 1
 outer loop
  vertex 0 0 0
  vertex 1 0 0
  vertex 0 1 0
 endloop
endfacet
endsolid test`;
    const mesh = parseStl(new TextEncoder().encode(ascii));
    expect(mesh.indices.length).toBe(3);
    expect(mesh.positions[3]).toBe(1);
  });

  it('rejects truncated binary STL', () => {
    const arch = generateSyntheticArch({ toothCount: 2 });
    const stl = exportStl(arch).slice(0, 200);
    expect(() => parseStl(stl)).toThrow(/truncated/);
  });
});

describe('OBJ round trip', () => {
  it('export → parse preserves counts', () => {
    const arch = generateSyntheticArch({ toothCount: 3 });
    const parsed = parseObj(exportObj(arch));
    expect(parsed.indices.length).toBe(arch.indices.length);
    expect(parsed.positions.length).toBe(arch.positions.length);
  });

  it('handles quads and negative indices', () => {
    const obj = `v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf -4 -3 -2 -1\n`;
    const mesh = parseObj(new TextEncoder().encode(obj));
    expect(mesh.indices.length).toBe(6); // quad → 2 triangles
  });
});

describe('PLY parser', () => {
  it('parses ASCII PLY with extra vertex properties', () => {
    const ply = `ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
property uchar red
element face 1
property list uchar int vertex_indices
end_header
0 0 0 255
1 0 0 255
0 1 0 255
3 0 1 2
`;
    const mesh = parsePly(new TextEncoder().encode(ply));
    expect(mesh.positions.length).toBe(9);
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2]);
  });

  it('parses binary_little_endian PLY', () => {
    const header = `ply\nformat binary_little_endian 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar uint vertex_indices\nend_header\n`;
    const headerBytes = new TextEncoder().encode(header);
    const body = new Uint8Array(3 * 12 + 1 + 12);
    const view = new DataView(body.buffer);
    const verts = [0, 0, 0, 2, 0, 0, 0, 2, 0];
    verts.forEach((v, i) => view.setFloat32(i * 4, v, true));
    view.setUint8(36, 3);
    view.setUint32(37, 0, true);
    view.setUint32(41, 1, true);
    view.setUint32(45, 2, true);
    const file = new Uint8Array(headerBytes.length + body.length);
    file.set(headerBytes);
    file.set(body, headerBytes.length);

    const mesh = parsePly(file);
    expect(mesh.positions[3]).toBe(2);
    expect(Array.from(mesh.indices)).toEqual([0, 1, 2]);
  });
});

describe('GLB round trip', () => {
  it('export → parse preserves geometry', () => {
    const arch = generateSyntheticArch({ toothCount: 2 });
    const withNormals = computeVertexNormals(arch);
    const glb = exportGlb(withNormals);
    expect(sniffFormat(glb)).toBe('GLB');
    const parsed = parseGlb(glb);
    expect(parsed.positions.length).toBe(arch.positions.length);
    expect(parsed.indices.length).toBe(arch.indices.length);
    const before = analyzeMesh(arch);
    const after = analyzeMesh(parsed);
    expect(after.volumeMm3).toBeCloseTo(before.volumeMm3, 1);
  });
});

describe('validation & optimization', () => {
  it('flags NaN vertices as errors', () => {
    const cube = unitCube();
    cube.positions[0] = NaN;
    const result = validateMesh(cube);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'NON_FINITE_VERTEX')).toBe(true);
  });

  it('welds STL triangle soup back to shared vertices', () => {
    const arch = generateSyntheticArch({ toothCount: 4 });
    const soup = parseStl(exportStl(arch));
    expect(soup.positions.length / 3).toBe(soup.indices.length); // soup: 3 verts/tri
    const welded = optimizeMesh(soup);
    expect(welded.positions.length).toBeLessThan(soup.positions.length / 3);
    expect(analyzeMesh(welded).surfaceAreaMm2).toBeCloseTo(analyzeMesh(soup).surfaceAreaMm2, 3);
  });

  it('drops degenerate triangles', () => {
    const cube = unitCube();
    const withDegenerate: RawMesh = {
      positions: cube.positions,
      indices: new Uint32Array([...Array.from(cube.indices), 0, 0, 1]),
    };
    const optimized = optimizeMesh(withDegenerate);
    expect(optimized.indices.length).toBe(cube.indices.length);
  });
});

describe('transforms', () => {
  it('centers a mesh on its bbox center', () => {
    const cube = unitCube();
    centerMesh(cube);
    const bounds = computeBounds(cube);
    expect(bounds.min[0]).toBeCloseTo(-0.5, 6);
    expect(bounds.max[2]).toBeCloseTo(0.5, 6);
  });

  it('rescales metre-unit scans to mm', () => {
    const cube = unitCube();
    for (let i = 0; i < cube.positions.length; i++) cube.positions[i] = cube.positions[i]! * 0.04; // 40mm arch in metres
    const { scaleApplied } = normalizeUnitsToMm(cube);
    expect(scaleApplied).toBe(1000);
    const bounds = computeBounds(cube);
    expect(bounds.max[0]! - bounds.min[0]!).toBeCloseTo(40, 3);
  });
});

describe('normals', () => {
  it('produces unit-length normals', () => {
    const mesh = computeVertexNormals(generateSyntheticArch({ toothCount: 2 }));
    expect(mesh.normals).toBeDefined();
    for (let v = 0; v < mesh.normals!.length; v += 3) {
      const len = Math.hypot(mesh.normals![v]!, mesh.normals![v + 1]!, mesh.normals![v + 2]!);
      expect(len).toBeCloseTo(1, 4);
    }
  });
});

describe('dental analysis', () => {
  it('honors the jaw hint with full confidence', () => {
    const arch = generateSyntheticArch();
    const detection = detectJaw(arch, 'UPPER');
    expect(detection.jaw).toBe('UPPER');
    expect(detection.confidence).toBe(1);
  });

  it('identifies the vertical axis of a flat arch', () => {
    const arch = generateSyntheticArch(); // XZ plane arch, Y = vertical
    const detection = detectJaw(arch);
    expect(detection.verticalAxis).toBe(1);
  });

  it('segments a full synthetic arch into 16 contiguous FDI teeth', () => {
    const arch = optimizeMesh(generateSyntheticArch({ toothCount: 16 }));
    centerMesh(arch);
    const jaw = detectJaw(arch, 'LOWER');
    const { mesh, teeth } = new ArchToothSegmenter().segment(arch, jaw);

    expect(teeth.length).toBe(16);

    // contiguous non-overlapping triangle ranges covering the whole mesh
    const sorted = [...teeth].sort((a, b) => a.triangleRange.start - b.triangleRange.start);
    let cursor = 0;
    for (const tooth of sorted) {
      expect(tooth.triangleRange.start).toBe(cursor);
      cursor += tooth.triangleRange.count;
    }
    expect(cursor).toBe(mesh.indices.length / 3);

    // all FDI numbers valid for the lower jaw and unique
    const fdis = teeth.map((t) => t.fdiNumber);
    expect(new Set(fdis).size).toBe(fdis.length);
    for (const fdi of fdis) {
      expect(fdi).toBeGreaterThanOrEqual(31);
      expect(fdi).toBeLessThanOrEqual(48);
    }
  });

  it('maps a partial anterior scan to front teeth', () => {
    const arch = optimizeMesh(generateSyntheticArch({ toothCount: 6, archRadiusMm: 24 }));
    centerMesh(arch);
    const jaw = detectJaw(arch, 'UPPER');
    const { teeth } = new ArchToothSegmenter().segment(arch, jaw);
    expect(teeth.length).toBe(6);
    // teeth should be near the anterior midline of the FDI order, not molars
    for (const tooth of teeth) {
      expect(tooth.fdiNumber % 10).toBeLessThanOrEqual(4);
    }
  });

  it('falls back to angular division on a continuous single-shell scan', () => {
    // one connected component: a single wide box is not segmentable by
    // connectivity; the segmenter must still return ≥1 valid tooth region
    const arch = optimizeMesh(generateSyntheticArch({ toothCount: 1, toothWidthMm: 30 }));
    centerMesh(arch);
    const jaw = detectJaw(arch, 'LOWER');
    const { teeth } = new ArchToothSegmenter().segment(arch, jaw);
    expect(teeth.length).toBeGreaterThanOrEqual(1);
    for (const tooth of teeth) {
      expect(tooth.confidence).toBeLessThan(0.9);
    }
  });
});

describe('processScan pipeline', () => {
  it('runs end-to-end on an STL upload and reports stages in order', async () => {
    const arch = generateSyntheticArch({ toothCount: 8 });
    const stl = exportStl(arch);
    const stages: string[] = [];
    const result = await processScan(stl, 'STL', {
      jawHint: 'UPPER',
      onStage: (stage) => void stages.push(stage),
    });

    expect(stages).toEqual(['VALIDATING', 'OPTIMIZING', 'ANALYZING', 'SEGMENTING']);
    expect(result.stats.triangleCount).toBeGreaterThan(0);
    expect(result.stats.vertexCount).toBeLessThan(arch.indices.length); // welded
    expect(result.jaw.jaw).toBe('UPPER');
    expect(result.teeth.length).toBeGreaterThan(0);
    expect(result.mesh.normals).toBeDefined();

    // centered
    const bounds = result.boundingBox;
    expect(bounds.min[0] + bounds.max[0]).toBeCloseTo(0, 1);
  });

  it('rejects garbage uploads', async () => {
    const garbage = new TextEncoder().encode('this is not a mesh at all, sorry');
    await expect(processScan(garbage, 'STL')).rejects.toThrow();
  });
});

describe('buildGrillzShell', () => {
  it('produces a closed, thicker shell over the selected teeth', async () => {
    const { buildGrillzShell } = await import('./dental/shell');
    const arch = optimizeMesh(generateSyntheticArch({ toothCount: 6 }));
    centerMesh(arch);
    const jaw = detectJaw(arch, 'UPPER');
    const { mesh, teeth } = new ArchToothSegmenter().segment(arch, jaw);

    const front = teeth.slice(1, 5); // 4 anterior teeth
    const shell = buildGrillzShell(mesh, front.map((t) => t.triangleRange), {
      thicknessMm: 0.8,
      offsetMm: 0.05,
      fitToleranceMm: 0.08,
      chamferMm: 0.2,
      edgeRadiusMm: 0.15,
    });

    const analysis = analyzeMesh(shell);
    expect(analysis.watertight).toBe(true);
    expect(analysis.volumeMm3).toBeGreaterThan(0);
    // shell volume ≈ covered area × wall thickness
    const coveredArea = front.reduce((s, t) => s + t.surfaceAreaMm2, 0);
    expect(analysis.volumeMm3).toBeGreaterThan(coveredArea * 0.4);
    expect(analysis.volumeMm3).toBeLessThan(coveredArea * 2.5);
  });
});
