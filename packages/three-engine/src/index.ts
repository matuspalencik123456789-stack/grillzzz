export { Viewport, makeSectionPlane, type ViewportProps } from './Viewport';
export { DentalScan, type DentalScanProps } from './DentalScan';
export { GrillzPreview, type GrillzPreviewProps } from './GrillzPreview';
export { useMeasurement, MeasureOverlay, type MeasureToolProps } from './MeasureTool';
export { useEngineDevControls, EngineDevPanel, type DevControlsState } from './DevControls';
export { LIGHTING_PRESETS, DEFAULT_LIGHTING, type LightingPreset } from './lighting';
export {
  createMetalMaterial,
  createToothMaterial,
  METAL_APPEARANCE,
  HIGHLIGHT_COLORS,
  type MetalAppearance,
} from './materials';
export { rawMeshToGeometry, toothGeometry, decimateIndices } from './geometry';
export { loadScanMesh } from './loaders';
