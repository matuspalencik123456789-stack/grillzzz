'use client';

import { Leva, useControls } from 'leva';
import { LIGHTING_PRESETS } from './lighting';

export interface DevControlsState {
  lighting: string;
  wireframe: boolean;
  shadows: boolean;
  envIntensity: number;
}

/**
 * Leva developer panel — rendering knobs for engine development. Hidden in
 * production builds; mount <EngineDevPanel> and read useEngineDevControls()
 * where the studio composes the viewport.
 */
export function useEngineDevControls(): DevControlsState {
  return useControls('engine', {
    lighting: { value: 'showroom', options: Object.keys(LIGHTING_PRESETS) },
    wireframe: false,
    shadows: true,
    envIntensity: { value: 1, min: 0, max: 3, step: 0.05 },
  });
}

export function EngineDevPanel({ hidden }: { hidden: boolean }) {
  return <Leva hidden={hidden} collapsed titleBar={{ title: 'Engine' }} />;
}
