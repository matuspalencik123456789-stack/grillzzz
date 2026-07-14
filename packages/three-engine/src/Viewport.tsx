'use client';

import { Suspense, useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import { DEFAULT_LIGHTING, LIGHTING_PRESETS, type LightingPreset } from './lighting';

export interface ViewportProps {
  children: ReactNode;
  /** key of LIGHTING_PRESETS — environment switching */
  lighting?: string;
  /** clipping plane for section view; null disables */
  sectionPlane?: THREE.Plane | null;
  /** camera distance bounds in mm */
  minDistance?: number;
  maxDistance?: number;
  enablePan?: boolean;
  shadows?: boolean;
  className?: string;
  overlay?: ReactNode;
}

/**
 * The reusable viewer shell: color-managed canvas, orbit/pan/zoom controls,
 * HDRI environment with switchable lighting presets, soft contact shadows and
 * optional global clipping (section view). Everything scene-specific comes in
 * as children; everything UI-state-specific comes in as props — the engine
 * holds no state of its own.
 */
export function Viewport({
  children,
  lighting = DEFAULT_LIGHTING,
  sectionPlane = null,
  minDistance = 30,
  maxDistance = 400,
  enablePan = true,
  shadows = true,
  className,
  overlay,
}: ViewportProps) {
  const preset: LightingPreset = LIGHTING_PRESETS[lighting] ?? LIGHTING_PRESETS[DEFAULT_LIGHTING]!;

  const clippingPlanes = useMemo(
    () => (sectionPlane ? [sectionPlane] : []),
    [sectionPlane],
  );

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows={shadows}
        dpr={[1, 2]}
        camera={{ position: [0, 35, 110], fov: 35, near: 0.5, far: 2000 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          localClippingEnabled: true,
        }}
        style={{ background: preset.background }}
      >
        <ClippingSync planes={clippingPlanes} />
        <ambientLight intensity={preset.ambient} />
        <directionalLight
          position={preset.key.position}
          intensity={preset.key.intensity}
          color={preset.key.color}
          castShadow={shadows}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={1}
          shadow-camera-far={500}
          shadow-camera-left={-80}
          shadow-camera-right={80}
          shadow-camera-top={80}
          shadow-camera-bottom={-80}
        />
        <directionalLight
          position={preset.fill.position}
          intensity={preset.fill.intensity}
          color={preset.fill.color}
        />
        <Suspense fallback={null}>
          <Environment preset={preset.environment} environmentIntensity={preset.envIntensity} />
          {children}
          {shadows && (
            <ContactShadows position={[0, -22, 0]} opacity={0.55} scale={160} blur={2.4} far={60} />
          )}
        </Suspense>
        <OrbitControls
          makeDefault
          enablePan={enablePan}
          enableDamping
          dampingFactor={0.08}
          minDistance={minDistance}
          maxDistance={maxDistance}
          maxPolarAngle={Math.PI * 0.95}
        />
      </Canvas>
      {overlay}
    </div>
  );
}

/** Keeps renderer-level clipping planes in sync with the section-view prop. */
function ClippingSync({ planes }: { planes: THREE.Plane[] }) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    gl.clippingPlanes = planes;
    return () => {
      gl.clippingPlanes = [];
    };
  }, [gl, planes]);
  return null;
}

/** Builds a section plane from an axis + offset for the section-view UI. */
export function makeSectionPlane(axis: 'x' | 'y' | 'z', offsetMm: number, flipped = false): THREE.Plane {
  const normal = new THREE.Vector3(
    axis === 'x' ? 1 : 0,
    axis === 'y' ? 1 : 0,
    axis === 'z' ? 1 : 0,
  );
  if (flipped) normal.negate();
  return new THREE.Plane(normal, offsetMm);
}
