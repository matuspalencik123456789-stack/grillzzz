import type { Config } from 'tailwindcss';
import { grillzPreset } from '@grillz/ui/tailwind-preset';

const config: Config = {
  presets: [grillzPreset as Config],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
    '../../packages/three-engine/src/**/*.{ts,tsx}',
  ],
  theme: {},
  plugins: [],
};

export default config;
