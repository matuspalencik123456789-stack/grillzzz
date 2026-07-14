'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { RawMesh } from '@grillz/cad-engine';
import type { ToothRegion } from '@grillz/shared-types';
import { rawMeshToGeometry, toothGeometry } from './geometry';
import { createToothMaterial, HIGHLIGHT_COLORS } from './materials';

export interface DentalScanProps {
  mesh: RawMesh;
  teeth: ToothRegion[];
  selectedTeeth: ReadonlySet<number>;
  onToothClick?: (fdiNumber: number, event: { shiftKey: boolean; metaKey: boolean }) => void;
  onToothHover?: (fdiNumber: number | null) => void;
  wireframe?: boolean;
  /** teeth covered by the grillz preview get hidden highlights */
  mutedTeeth?: ReadonlySet<number>;
}

/**
 * The scanned arch as individually pickable teeth. Every tooth is a Mesh
 * whose geometry shares the parent vertex buffers and slices the index
 * range produced by segmentation — hover/selection are per-mesh material
 * swaps, never geometry work.
 */
export const DentalScan = memo(function DentalScan({
  mesh,
  teeth,
  selectedTeeth,
  onToothClick,
  onToothHover,
  wireframe = false,
  mutedTeeth,
}: DentalScanProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const parentGeometry = useMemo(() => rawMeshToGeometry(mesh), [mesh]);
  const toothGeometries = useMemo(
    () =>
      teeth.map((tooth) => ({
        tooth,
        geometry: toothGeometry(parentGeometry, mesh.indices, tooth.triangleRange),
      })),
    [teeth, parentGeometry, mesh.indices],
  );

  const baseMaterial = useMemo(() => createToothMaterial(), []);
  const hoverMaterial = useMemo(() => {
    const m = createToothMaterial();
    m.emissive = new THREE.Color(HIGHLIGHT_COLORS.hover);
    m.emissiveIntensity = 0.35;
    return m;
  }, []);
  const selectedMaterial = useMemo(() => {
    const m = createToothMaterial();
    m.emissive = new THREE.Color(HIGHLIGHT_COLORS.selected);
    m.emissiveIntensity = 0.5;
    return m;
  }, []);

  useEffect(() => {
    for (const material of [baseMaterial, hoverMaterial, selectedMaterial]) {
      material.wireframe = wireframe;
    }
  }, [wireframe, baseMaterial, hoverMaterial, selectedMaterial]);

  useEffect(
    () => () => {
      parentGeometry.dispose();
      for (const { geometry } of toothGeometries) geometry.dispose();
      baseMaterial.dispose();
      hoverMaterial.dispose();
      selectedMaterial.dispose();
    },
    [parentGeometry, toothGeometries, baseMaterial, hoverMaterial, selectedMaterial],
  );

  return (
    <group>
      {toothGeometries.map(({ tooth, geometry }) => {
        const fdi = tooth.fdiNumber;
        const muted = mutedTeeth?.has(fdi) ?? false;
        const material =
          !muted && selectedTeeth.has(fdi)
            ? selectedMaterial
            : !muted && hovered === fdi
              ? hoverMaterial
              : baseMaterial;
        return (
          <mesh
            key={fdi}
            geometry={geometry}
            material={material}
            castShadow
            receiveShadow
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onToothClick?.(fdi, { shiftKey: e.shiftKey, metaKey: e.metaKey || e.ctrlKey });
            }}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              setHovered(fdi);
              onToothHover?.(fdi);
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setHovered((current) => (current === fdi ? null : current));
              onToothHover?.(null);
              document.body.style.cursor = 'auto';
            }}
          />
        );
      })}
    </group>
  );
});
