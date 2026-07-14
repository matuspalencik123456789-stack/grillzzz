'use client';

import { create } from 'zustand';
import {
  archOrder,
  clampGrillzConfig,
  defaultGrillzConfig,
  isLower,
  isUpper,
  type GrillzConfig,
  type GrillzSetType,
} from '@grillz/shared-types';

export interface StudioViewerState {
  lighting: string;
  wireframe: boolean;
  sectionEnabled: boolean;
  sectionOffset: number;
  measureActive: boolean;
  showScan: boolean;
}

interface StudioState {
  /** design document being edited (authoritative copy lives on the server) */
  config: GrillzConfig;
  dirty: boolean;
  hoveredTooth: number | null;
  viewer: StudioViewerState;

  loadConfig: (config: GrillzConfig) => void;
  markSaved: () => void;
  setHovered: (fdi: number | null) => void;
  toggleTooth: (fdi: number, additive: boolean) => void;
  applySetType: (setType: GrillzSetType, availableTeeth: number[]) => void;
  updateConfig: (patch: Partial<GrillzConfig>) => void;
  updateGeometry: (patch: Partial<GrillzConfig['geometry']>) => void;
  updateDiamonds: (patch: Partial<GrillzConfig['diamonds']>) => void;
  setViewer: (patch: Partial<StudioViewerState>) => void;
}

/**
 * Selecting a set type resolves to concrete FDI numbers against the teeth the
 * scan actually detected, walking the arch outward from the midline.
 */
export function teethForSetType(setType: GrillzSetType, available: number[]): number[] {
  const availableSet = new Set(available);
  const uppers = available.filter(isUpper);
  const lowers = available.filter(isLower);

  const pickFront = (jaw: 'UPPER' | 'LOWER', count: number): number[] => {
    // arch order is right→left; the midline sits between index 7 and 8
    const order = archOrder(jaw).filter((n) => availableSet.has(n));
    const mid = order.length / 2;
    return [...order]
      .sort((a, b) => Math.abs(order.indexOf(a) - mid + 0.5) - Math.abs(order.indexOf(b) - mid + 0.5))
      .slice(0, count)
      .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  };

  const dominantJaw: 'UPPER' | 'LOWER' = uppers.length >= lowers.length ? 'UPPER' : 'LOWER';

  switch (setType) {
    case 'SINGLE':
      return pickFront(dominantJaw, 1);
    case 'DUO':
      return pickFront(dominantJaw, 2);
    case 'QUAD':
      return pickFront(dominantJaw, 4);
    case 'SIX':
      return pickFront(dominantJaw, 6);
    case 'EIGHT':
      return pickFront(dominantJaw, 8);
    case 'UPPER':
      return uppers;
    case 'LOWER':
      return lowers;
    case 'FULL_SET':
      return [...uppers, ...lowers];
  }
}

/** set type implied by a manual tooth selection */
export function setTypeForTeeth(teeth: number[]): GrillzSetType {
  const uppers = teeth.filter(isUpper).length;
  const lowers = teeth.filter(isLower).length;
  if (uppers > 0 && lowers > 0) return 'FULL_SET';
  const count = teeth.length;
  if (count === 1) return 'SINGLE';
  if (count === 2) return 'DUO';
  if (count <= 4) return 'QUAD';
  if (count <= 6) return 'SIX';
  if (count <= 8) return 'EIGHT';
  return uppers > 0 ? 'UPPER' : 'LOWER';
}

export const useStudioStore = create<StudioState>((set) => ({
  config: defaultGrillzConfig([11]),
  dirty: false,
  hoveredTooth: null,
  viewer: {
    lighting: 'showroom',
    wireframe: false,
    sectionEnabled: false,
    sectionOffset: 0,
    measureActive: false,
    showScan: true,
  },

  loadConfig: (config) => set({ config: clampGrillzConfig(config), dirty: false }),
  markSaved: () => set({ dirty: false }),
  setHovered: (fdi) => set({ hoveredTooth: fdi }),

  toggleTooth: (fdi, additive) =>
    set((state) => {
      const current = new Set(state.config.toothNumbers);
      if (additive) {
        if (current.has(fdi)) current.delete(fdi);
        else current.add(fdi);
      } else {
        if (current.has(fdi) && current.size === 1) return state;
        current.clear();
        current.add(fdi);
      }
      if (current.size === 0) return state;
      const toothNumbers = [...current].sort((a, b) => a - b);
      return {
        config: { ...state.config, toothNumbers, setType: setTypeForTeeth(toothNumbers) },
        dirty: true,
      };
    }),

  applySetType: (setType, availableTeeth) =>
    set((state) => {
      const teeth = teethForSetType(setType, availableTeeth);
      if (teeth.length === 0) return state;
      return {
        config: { ...state.config, setType, toothNumbers: teeth },
        dirty: true,
      };
    }),

  updateConfig: (patch) =>
    set((state) => ({ config: clampGrillzConfig({ ...state.config, ...patch }), dirty: true })),
  updateGeometry: (patch) =>
    set((state) => ({
      config: clampGrillzConfig({
        ...state.config,
        geometry: { ...state.config.geometry, ...patch },
      }),
      dirty: true,
    })),
  updateDiamonds: (patch) =>
    set((state) => ({
      config: clampGrillzConfig({
        ...state.config,
        diamonds: { ...state.config.diamonds, ...patch },
      }),
      dirty: true,
    })),
  setViewer: (patch) => set((state) => ({ viewer: { ...state.viewer, ...patch } })),
}));
