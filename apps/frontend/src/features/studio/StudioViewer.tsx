'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DentalScan,
  GrillzPreview,
  MeasureOverlay,
  Viewport,
  loadScanMesh,
  makeSectionPlane,
  useMeasurement,
} from '@grillz/three-engine';
import type { RawMesh } from '@grillz/cad-engine';
import type { ToothRegion } from '@grillz/shared-types';
import { useStudioStore } from './store';
import type { ScanRow } from '@/features/api/types';

export interface StudioViewerProps {
  scan: ScanRow;
  meshUrl: string;
}

/**
 * Client-only 3D composition (dynamically imported with ssr:false). Loads the
 * processed GLB once into raw typed arrays shared by the pickable teeth and
 * the shell preview.
 */
export default function StudioViewer({ scan, meshUrl }: StudioViewerProps) {
  const [mesh, setMesh] = useState<RawMesh | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const config = useStudioStore((s) => s.config);
  const viewer = useStudioStore((s) => s.viewer);
  const toggleTooth = useStudioStore((s) => s.toggleTooth);
  const setHovered = useStudioStore((s) => s.setHovered);

  useEffect(() => {
    const controller = new AbortController();
    loadScanMesh(meshUrl, controller.signal)
      .then(setMesh)
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load mesh');
        }
      });
    return () => controller.abort();
  }, [meshUrl]);

  const teeth: ToothRegion[] = useMemo(
    () =>
      (scan.teeth ?? []).map((t) => ({
        fdiNumber: t.fdiNumber,
        centroid: t.centroid,
        boundingBox: t.boundingBox,
        surfaceAreaMm2: t.surfaceAreaMm2,
        triangleRange: t.triangleRange,
        confidence: t.confidence,
      })),
    [scan.teeth],
  );

  const selectedTeeth = useMemo(() => new Set(config.toothNumbers), [config.toothNumbers]);

  const sectionPlane = useMemo(
    () => (viewer.sectionEnabled ? makeSectionPlane('x', viewer.sectionOffset) : null),
    [viewer.sectionEnabled, viewer.sectionOffset],
  );

  const measurement = useMeasurement(viewer.measureActive);

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-red-400">
        {loadError}
      </div>
    );
  }
  if (!mesh) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
          <p className="text-sm text-muted-foreground">Streaming scan geometry…</p>
        </div>
      </div>
    );
  }

  return (
    <Viewport lighting={viewer.lighting} sectionPlane={sectionPlane} className="h-full w-full">
      <group onPointerDown={measurement.handlePointerDown}>
        {viewer.showScan && (
          <DentalScan
            mesh={mesh}
            teeth={teeth}
            selectedTeeth={selectedTeeth}
            wireframe={viewer.wireframe}
            onToothClick={(fdi, e) => toggleTooth(fdi, e.shiftKey || e.metaKey)}
            onToothHover={setHovered}
          />
        )}
        <GrillzPreview
          scanMesh={mesh}
          teeth={teeth}
          coveredTeeth={selectedTeeth}
          material={config.material}
          finish={config.finish}
          geometry={config.geometry}
          wireframe={viewer.wireframe}
        />
      </group>
      <MeasureOverlay points={measurement.points} />
    </Viewport>
  );
}
