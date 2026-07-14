'use client';

import { useCallback, useState } from 'react';
import * as THREE from 'three';
import { Html, Line, Sphere } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';

export interface MeasureToolProps {
  /** enable click-to-measure; parent toggles this from the toolbar */
  active: boolean;
  onMeasure?: (distanceMm: number) => void;
}

/**
 * Point-to-point measurement. When active, an invisible full-scene plane
 * isn't used — instead the tool captures clicks that bubble from any mesh
 * (attach <MeasureCatcher> alongside your scene meshes). Two points → line +
 * mm label; a third click starts a new measurement.
 */
export function useMeasurement(active: boolean, onMeasure?: (distanceMm: number) => void) {
  const [points, setPoints] = useState<THREE.Vector3[]>([]);

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!active) return;
      event.stopPropagation();
      const point = event.point.clone();
      setPoints((current) => {
        const next = current.length >= 2 ? [point] : [...current, point];
        if (next.length === 2) onMeasure?.(next[0]!.distanceTo(next[1]!));
        return next;
      });
    },
    [active, onMeasure],
  );

  const clear = useCallback(() => setPoints([]), []);
  return { points, handlePointerDown, clear };
}

export function MeasureOverlay({ points }: { points: THREE.Vector3[] }) {
  const distance = points.length === 2 ? points[0]!.distanceTo(points[1]!) : null;
  const midpoint =
    points.length === 2
      ? points[0]!.clone().add(points[1]!).multiplyScalar(0.5)
      : null;

  return (
    <group>
      {points.map((p, i) => (
        <Sphere key={i} args={[0.6, 16, 16]} position={p}>
          <meshBasicMaterial color="#67e8f9" depthTest={false} transparent opacity={0.95} />
        </Sphere>
      ))}
      {points.length === 2 && (
        <>
          <Line
            points={[points[0]!, points[1]!]}
            color="#67e8f9"
            lineWidth={2}
            depthTest={false}
          />
          {midpoint && distance !== null && (
            <Html position={midpoint} center distanceFactor={80} style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  background: 'rgba(8, 10, 14, 0.85)',
                  color: '#e8fbff',
                  border: '1px solid rgba(103, 232, 249, 0.4)',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 12,
                  fontFamily: 'ui-monospace, monospace',
                  whiteSpace: 'nowrap',
                }}
              >
                {distance.toFixed(2)} mm
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  );
}
