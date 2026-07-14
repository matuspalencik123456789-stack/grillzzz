/** BullMQ queue names and job payloads shared by API and workers. */

export const QUEUES = {
  scanPipeline: 'scan-pipeline',
  rendering: 'rendering',
  notifications: 'notifications',
} as const;

export interface ScanPipelineJob {
  scanId: string;
  fileKey: string;
  format: 'STL' | 'PLY' | 'OBJ' | 'GLB' | 'GLTF';
  jawHint?: 'UPPER' | 'LOWER' | 'FULL' | 'UNKNOWN';
}

export interface RenderingJobPayload {
  renderingJobId: string;
  type: 'THUMBNAIL' | 'TURNTABLE' | 'EXPORT_STL' | 'EXPORT_OBJ' | 'EXPORT_GLTF' | 'PRODUCTION_PDF';
  grillzId?: string;
  scanId?: string;
}

export interface NotificationJobPayload {
  userId: string;
  type: 'SCAN_READY' | 'SCAN_FAILED' | 'QUOTE_READY' | 'ORDER_STATUS' | 'PRODUCTION_UPDATE' | 'SYSTEM';
  title: string;
  body: string;
  data?: Record<string, unknown>;
}
