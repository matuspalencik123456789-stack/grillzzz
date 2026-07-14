'use client';

import { Suspense, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, Sparkles } from '@react-three/drei';
import type { MotionValue } from 'framer-motion';
import {
  centerMesh,
  generateSyntheticArch,
  optimizeMesh,
  smoothMesh,
} from '@grillz/cad-engine';
import { rawMeshToGeometry } from '@grillz/three-engine';

export interface ShowcaseStop {
  color: string;
  roughness: number;
}

export interface GrillzSceneProps {
  /** scroll progress 0..1 driving rotation + material morphing */
  progress: MotionValue<number>;
  stops: ShowcaseStop[];
}

/**
 * The scroll-bound hero piece: a smoothed 8-tooth gold arch generated
 * entirely by cad-engine at runtime — no model files to load. Scroll rotates
 * it and cross-fades the metal through the section stops.
 */
export default function GrillzScene({ progress, stops }: GrillzSceneProps) {
  const geometry = useMemo(() => {
    const arch = optimizeMesh(generateSyntheticArch({ toothCount: 8, detail: 5 }));
    const rounded = smoothMesh(arch, { iterations: 10 });
    centerMesh(rounded);
    return rawMeshToGeometry(rounded);
  }, []);

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 12, 78], fov: 32, near: 0.5, far: 600 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, alpha: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.25} />
      <directionalLight position={[40, 60, 40]} intensity={2.4} color="#fff3dd" />
      <directionalLight position={[-50, 20, -30]} intensity={0.7} color="#dfe8ff" />
      <Suspense fallback={null}>
        {/* procedural studio environment — no HDR download, works offline */}
        <Environment resolution={256}>
          <Lightformer intensity={4} position={[0, 40, 0]} rotation-x={Math.PI / 2} scale={[80, 80, 1]} color="#fff6e6" />
          <Lightformer intensity={2.2} position={[-40, 10, 20]} rotation-y={Math.PI / 2} scale={[60, 20, 1]} color="#ffe2b0" />
          <Lightformer intensity={1.6} position={[45, 5, -10]} rotation-y={-Math.PI / 2} scale={[50, 16, 1]} color="#dfe8ff" />
          <Lightformer intensity={0.8} position={[0, -30, 30]} rotation-x={-Math.PI / 3} scale={[70, 30, 1]} color="#fefefe" />
        </Environment>
        <SpinningGrillz geometry={geometry} progress={progress} stops={stops} />
        <ContactShadows position={[0, -20, 0]} opacity={0.5} scale={140} blur={2.6} far={50} />
      </Suspense>
    </Canvas>
  );
}

function SpinningGrillz({
  geometry,
  progress,
  stops,
}: {
  geometry: THREE.BufferGeometry;
  progress: MotionValue<number>;
  stops: ShowcaseStop[];
}) {
  const group = useRef<THREE.Group>(null);
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(stops[0]?.color ?? '#f0c649'),
        metalness: 1,
        roughness: stops[0]?.roughness ?? 0.12,
        clearcoat: 0.6,
        clearcoatRoughness: 0.25,
        envMapIntensity: 1.3,
      }),
    [stops],
  );
  const targetColor = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    const p = THREE.MathUtils.clamp(progress.get(), 0, 1);
    if (group.current) {
      // two full turns across the page, softly damped toward the target;
      // the -π/10 bias keeps the piece slightly angled (never dead-on flat)
      const targetY = p * Math.PI * 4 - Math.PI / 10;
      group.current.rotation.y += (targetY - group.current.rotation.y) * Math.min(1, delta * 5);
      group.current.rotation.x = -0.3 + Math.sin(p * Math.PI) * 0.15;
      group.current.position.y = 4 + Math.sin(p * Math.PI * 2) * 2;
    }

    // material cross-fade between section stops
    const segment = p * (stops.length - 1);
    const index = Math.min(stops.length - 2, Math.floor(segment));
    const t = segment - index;
    const from = stops[index]!;
    const to = stops[index + 1]!;
    targetColor.set(from.color).lerp(new THREE.Color(to.color), t);
    material.color.lerp(targetColor, Math.min(1, delta * 8));
    material.roughness += (THREE.MathUtils.lerp(from.roughness, to.roughness, t) - material.roughness) * Math.min(1, delta * 8);
  });

  return (
    <group ref={group}>
      <mesh geometry={geometry} material={material} />
      <Sparkles count={70} scale={[70, 30, 40]} size={2.2} speed={0.25} opacity={0.5} color="#ffe9b0" />
    </group>
  );
}
