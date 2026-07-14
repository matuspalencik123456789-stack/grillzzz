'use client';

import { memo, useEffect, useMemo } from 'react';
import { buildGrillzShell, type RawMesh } from '@grillz/cad-engine';
import type { GrillzGeometry, MaterialType, SurfaceFinish, ToothRegion } from '@grillz/shared-types';
import { rawMeshToGeometry } from './geometry';
import { createMetalMaterial, type MetalAppearance } from './materials';

export interface GrillzPreviewProps {
  scanMesh: RawMesh;
  teeth: ToothRegion[];
  coveredTeeth: ReadonlySet<number>;
  material: MaterialType;
  finish: SurfaceFinish;
  geometry: GrillzGeometry;
  appearanceOverride?: Partial<MetalAppearance>;
  wireframe?: boolean;
}

/**
 * Realtime grillz preview: the same buildGrillzShell() that produces
 * manufacturing files runs in the browser on the selected tooth ranges, so
 * what the customer sees is byte-identical geometry to what the lab prints.
 * Rebuilds only when coverage or geometry parameters change.
 */
export const GrillzPreview = memo(function GrillzPreview({
  scanMesh,
  teeth,
  coveredTeeth,
  material,
  finish,
  geometry,
  appearanceOverride,
  wireframe = false,
}: GrillzPreviewProps) {
  const shellGeometry = useMemo(() => {
    const ranges = teeth
      .filter((tooth) => coveredTeeth.has(tooth.fdiNumber))
      .map((tooth) => tooth.triangleRange);
    if (ranges.length === 0) return null;
    const shell = buildGrillzShell(scanMesh, ranges, geometry);
    return rawMeshToGeometry(shell);
    // geometry object identity churns per-slider-tick; depend on values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scanMesh,
    teeth,
    coveredTeeth,
    geometry.thicknessMm,
    geometry.offsetMm,
    geometry.fitToleranceMm,
    geometry.chamferMm,
    geometry.edgeRadiusMm,
  ]);

  const metalMaterial = useMemo(
    () => createMetalMaterial(material, finish, appearanceOverride),
    [material, finish, appearanceOverride],
  );

  useEffect(() => {
    metalMaterial.wireframe = wireframe;
  }, [wireframe, metalMaterial]);

  useEffect(
    () => () => {
      shellGeometry?.dispose();
      metalMaterial.dispose();
    },
    [shellGeometry, metalMaterial],
  );

  if (!shellGeometry) return null;
  return <mesh geometry={shellGeometry} material={metalMaterial} castShadow receiveShadow />;
});
