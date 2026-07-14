import type {
  GrillzConfig,
  GrillzSetType,
  GrillzStatus,
  JawKind,
  MeshStats,
  BoundingBox,
  OrderStatus,
  PatternKind,
  PriceQuote,
  ProductionStage,
  ProjectStatus,
  ScanStatus,
  ToothRegion,
  MaterialType,
  NotificationType,
} from '@grillz/shared-types';

/** API resource shapes (Prisma rows serialized to JSON). */

export interface MaterialRow {
  id: string;
  type: MaterialType;
  name: string;
  densityGCm3: number;
  pricePerGram: number;
  colorHex: string;
  metalness: number;
  roughness: number;
}

export interface PatternRow {
  id: string;
  kind: PatternKind;
  name: string;
  description: string;
  laborFactor: number;
}

export interface ToothRow extends Omit<ToothRegion, 'triangleRange'> {
  id: string;
  scanId: string;
  triangleRange: { start: number; count: number };
}

export interface ScanRow {
  id: string;
  projectId: string;
  name: string;
  format: string;
  jaw: JawKind;
  status: ScanStatus;
  thumbnailKey: string | null;
  processedGlbKey: string | null;
  meshStats: MeshStats | null;
  boundingBox: BoundingBox | null;
  errorMessage: string | null;
  createdAt: string;
  teeth?: ToothRow[];
}

export interface GrillzRow {
  id: string;
  projectId: string;
  name: string;
  status: GrillzStatus;
  setType: GrillzSetType;
  toothNumbers: number[];
  configJson: GrillzConfig;
  priceSnapshot: PriceQuote | null;
  material: MaterialRow;
  pattern: PatternRow | null;
  project?: { id: string; name: string };
  updatedAt: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  updatedAt: string;
  scans: Array<Pick<ScanRow, 'id' | 'status' | 'thumbnailKey' | 'jaw'>>;
  _count?: { grillz: number; orders: number };
}

export interface ProjectDetail extends Omit<ProjectRow, 'scans' | '_count'> {
  scans: ScanRow[];
  grillz: GrillzRow[];
}

export interface OrderRow {
  id: string;
  number: string;
  status: OrderStatus;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  shippingMinor: number;
  totalMinor: number;
  placedAt: string;
  items: Array<{ id: string; grillz: GrillzRow; unitPriceMinor: number }>;
  payments: Array<{ id: string; provider: string; status: string; amountMinor: number }>;
  productionJob: { id: string; stage: ProductionStage } | null;
}

export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  data: Record<string, unknown> | null;
}

export interface ManufacturingArtifact {
  format: 'STL' | 'OBJ' | 'GLTF' | 'PDF';
  fileKey: string;
  sizeBytes: number;
  url: string;
}
