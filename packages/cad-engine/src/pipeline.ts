import type { JawKind, MeshStats, ToothRegion } from '@grillz/shared-types';
import type { RawMesh, MeshValidationIssue } from './types';
import { parseMesh } from './parsers';
import { validateMesh } from './validate';
import { optimizeMesh } from './optimize';
import { centerMesh, computeBounds, normalizeUnitsToMm } from './transform';
import { computeVertexNormals } from './normals';
import { analyzeMesh } from './analyze';
import { detectJaw, type JawDetection } from './dental/jaw';
import { ArchToothSegmenter, type ToothSegmenter } from './dental/segmentation';
import type { ScanFormat, BoundingBox } from '@grillz/shared-types';

export interface ScanPipelineResult {
  mesh: RawMesh;
  stats: MeshStats;
  boundingBox: BoundingBox;
  jaw: JawDetection;
  teeth: ToothRegion[];
  warnings: MeshValidationIssue[];
  unitScaleApplied: number;
}

export type ScanPipelineStage =
  | 'VALIDATING'
  | 'OPTIMIZING'
  | 'ANALYZING'
  | 'SEGMENTING';

export interface ScanPipelineOptions {
  jawHint?: JawKind;
  segmenter?: ToothSegmenter;
  onStage?: (stage: ScanPipelineStage) => void | Promise<void>;
}

/**
 * The full scan-intake pipeline:
 * validate → optimize → center → normals → bbox → jaw detect → tooth segmentation.
 * Pure and synchronous by design; the backend worker wraps it with persistence
 * and progress reporting via `onStage`.
 */
export async function processScan(
  data: Uint8Array,
  format: ScanFormat,
  options: ScanPipelineOptions = {},
): Promise<ScanPipelineResult> {
  await options.onStage?.('VALIDATING');
  const parsed = parseMesh(data, format);
  const validation = validateMesh(parsed);
  if (!validation.ok) {
    const errors = validation.issues.filter((i) => i.severity === 'ERROR');
    throw new Error(`Mesh validation failed: ${errors.map((e) => e.message).join('; ')}`);
  }

  await options.onStage?.('OPTIMIZING');
  const { scaleApplied } = normalizeUnitsToMm(parsed);
  let mesh = optimizeMesh(parsed);
  centerMesh(mesh);
  mesh = computeVertexNormals(mesh);

  await options.onStage?.('ANALYZING');
  const analysis = analyzeMesh(mesh);
  const jaw = detectJaw(mesh, options.jawHint);

  await options.onStage?.('SEGMENTING');
  const segmenter = options.segmenter ?? new ArchToothSegmenter();
  const segmentation = segmenter.segment(mesh, jaw);
  // segmentation reorders indices; recompute nothing else — geometry is unchanged
  mesh = segmentation.mesh;

  return {
    mesh,
    stats: {
      vertexCount: analysis.vertexCount,
      triangleCount: analysis.triangleCount,
      surfaceAreaMm2: round2(analysis.surfaceAreaMm2),
      volumeMm3: round2(analysis.volumeMm3),
      watertight: analysis.watertight,
    },
    boundingBox: computeBounds(mesh),
    jaw,
    teeth: segmentation.teeth,
    warnings: validation.issues.filter((i) => i.severity === 'WARNING'),
    unitScaleApplied: scaleApplied,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
