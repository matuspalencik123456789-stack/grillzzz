/**
 * Lighting presets pair a drei Environment (HDRI) with studio lights tuned
 * for metal rendering. Environments provide the realtime reflections that
 * sell gold; the key/fill lights shape the form.
 */

export type EnvironmentPreset =
  | 'studio'
  | 'city'
  | 'sunset'
  | 'warehouse'
  | 'night'
  | 'apartment';

export interface LightingPreset {
  id: string;
  label: string;
  environment: EnvironmentPreset;
  /** environment intensity multiplier */
  envIntensity: number;
  ambient: number;
  key: { position: [number, number, number]; intensity: number; color: string };
  fill: { position: [number, number, number]; intensity: number; color: string };
  background: string;
}

export const LIGHTING_PRESETS: Record<string, LightingPreset> = {
  showroom: {
    id: 'showroom',
    label: 'Showroom',
    environment: 'studio',
    envIntensity: 1.1,
    ambient: 0.25,
    key: { position: [40, 60, 40], intensity: 2.2, color: '#fff6e8' },
    fill: { position: [-50, 20, -30], intensity: 0.8, color: '#dfe8ff' },
    background: '#0b0b0e',
  },
  daylight: {
    id: 'daylight',
    label: 'Daylight',
    environment: 'city',
    envIntensity: 0.9,
    ambient: 0.45,
    key: { position: [30, 80, 20], intensity: 1.6, color: '#ffffff' },
    fill: { position: [-40, 30, 50], intensity: 0.6, color: '#ffffff' },
    background: '#101318',
  },
  golden: {
    id: 'golden',
    label: 'Golden Hour',
    environment: 'sunset',
    envIntensity: 1.3,
    ambient: 0.2,
    key: { position: [60, 25, 10], intensity: 2.6, color: '#ffc37a' },
    fill: { position: [-30, 15, -40], intensity: 0.5, color: '#7a86ff' },
    background: '#120e0a',
  },
  noir: {
    id: 'noir',
    label: 'Noir',
    environment: 'night',
    envIntensity: 0.7,
    ambient: 0.1,
    key: { position: [25, 45, 55], intensity: 3.2, color: '#f2f4ff' },
    fill: { position: [-60, 10, -20], intensity: 0.25, color: '#4455ff' },
    background: '#050507',
  },
};

export const DEFAULT_LIGHTING = 'showroom';
