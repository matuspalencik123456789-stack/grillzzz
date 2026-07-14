'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AiDesignRequest,
  AiDesignResponse,
  AiRecommendationResponse,
  AiValidationReport,
  CreateGrillzDto,
  CreateProjectDto,
  CreateScanUploadDto,
  GrillzConfig,
  Paginated,
  PlaceOrderDto,
  PriceQuote,
  ScanUploadTicket,
} from '@grillz/shared-types';
import { api, uploadToPresignedUrl } from '@/lib/api-client';
import type {
  GrillzRow,
  ManufacturingArtifact,
  MaterialRow,
  NotificationRow,
  OrderRow,
  PatternRow,
  ProjectDetail,
  ProjectRow,
  ScanRow,
} from './types';

export const keys = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  scan: (id: string) => ['scans', id] as const,
  scanMesh: (id: string) => ['scans', id, 'mesh'] as const,
  designs: ['designs'] as const,
  design: (id: string) => ['designs', id] as const,
  favorites: ['favorites'] as const,
  orders: ['orders'] as const,
  order: (id: string) => ['orders', id] as const,
  invoice: (id: string) => ['orders', id, 'invoice'] as const,
  notifications: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
  materials: ['catalog', 'materials'] as const,
  patterns: ['catalog', 'patterns'] as const,
};

// ── catalog ─────────────────────────────────────────────────────────────────

export function useMaterials() {
  return useQuery({
    queryKey: keys.materials,
    queryFn: () => api<MaterialRow[]>('/catalog/materials'),
    staleTime: 5 * 60_000,
  });
}

export function usePatterns() {
  return useQuery({
    queryKey: keys.patterns,
    queryFn: () => api<PatternRow[]>('/catalog/patterns'),
    staleTime: 5 * 60_000,
  });
}

// ── projects ────────────────────────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: keys.projects,
    queryFn: () => api<Paginated<ProjectRow>>('/projects?page=1&pageSize=50'),
  });
}

export function useProject(id: string, options: { pollWhileProcessing?: boolean } = {}) {
  return useQuery({
    queryKey: keys.project(id),
    queryFn: () => api<ProjectDetail>(`/projects/${id}`),
    refetchInterval: options.pollWhileProcessing
      ? (query) => {
          const scans = query.state.data?.scans ?? [];
          const busy = scans.some(
            (s) => !['READY', 'FAILED', 'AWAITING_UPLOAD'].includes(s.status),
          );
          return busy ? 2500 : false;
        }
      : false,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProjectDto) => api<ProjectRow>('/projects', { method: 'POST', body: dto }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.projects }),
  });
}

// ── scans ───────────────────────────────────────────────────────────────────

export function useUploadScan(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      dto,
      onProgress,
    }: {
      file: File;
      dto: CreateScanUploadDto;
      onProgress?: (fraction: number) => void;
    }) => {
      const ticket = await api<ScanUploadTicket>('/scans/uploads', { method: 'POST', body: dto });
      await uploadToPresignedUrl(ticket.uploadUrl, file, onProgress);
      await api(`/scans/uploads/complete`, { method: 'POST', body: { scanId: ticket.scanId } });
      return ticket.scanId;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.project(projectId) }),
  });
}

export function useScanMeshUrl(scanId: string | null) {
  return useQuery({
    queryKey: keys.scanMesh(scanId ?? 'none'),
    queryFn: () => api<{ url: string }>(`/scans/${scanId}/mesh-url`),
    enabled: scanId !== null,
    staleTime: 30 * 60_000,
  });
}

// ── grillz designs ──────────────────────────────────────────────────────────

export function useDesigns() {
  return useQuery({ queryKey: keys.designs, queryFn: () => api<GrillzRow[]>('/grillz') });
}

export function useDesign(id: string) {
  return useQuery({
    queryKey: keys.design(id),
    queryFn: () => api<GrillzRow>(`/grillz/${id}`),
  });
}

export function useCreateDesign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateGrillzDto) => api<GrillzRow>('/grillz', { method: 'POST', body: dto }),
    onSuccess: (design) => {
      void queryClient.invalidateQueries({ queryKey: keys.designs });
      void queryClient.invalidateQueries({ queryKey: keys.project(design.projectId) });
    },
  });
}

export function useUpdateDesign(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name?: string; config?: GrillzConfig }) =>
      api<GrillzRow>(`/grillz/${id}`, { method: 'PATCH', body: dto }),
    onSuccess: (design) => {
      queryClient.setQueryData(keys.design(id), design);
      void queryClient.invalidateQueries({ queryKey: keys.designs });
    },
  });
}

export function usePriceDesign(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { countryCode?: string; expedited?: boolean } = {}) =>
      api<PriceQuote>(`/grillz/${id}/price`, { method: 'POST', body }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.design(id) }),
  });
}

export function useExportDesign(id: string) {
  return useMutation({
    mutationFn: () => api<ManufacturingArtifact[]>(`/grillz/${id}/export`, { method: 'POST', body: {} }),
  });
}

export function useFavorites() {
  return useQuery({
    queryKey: keys.favorites,
    queryFn: () => api<Array<{ id: string; grillz: GrillzRow }>>('/grillz/favorites'),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (grillzId: string) =>
      api<{ favorite: boolean }>(`/grillz/${grillzId}/favorite`, { method: 'POST', body: {} }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.favorites }),
  });
}

// ── AI ──────────────────────────────────────────────────────────────────────

export function useAiDesigns() {
  return useMutation({
    mutationFn: (request: AiDesignRequest) =>
      api<AiDesignResponse>('/ai/designs', { method: 'POST', body: request }),
  });
}

export function useAiValidation() {
  return useMutation({
    mutationFn: (config: GrillzConfig) =>
      api<AiValidationReport>('/ai/validate', { method: 'POST', body: config }),
  });
}

export function useAiRecommend() {
  return useMutation({
    mutationFn: (body: { prompt: string; budgetMinor?: number }) =>
      api<AiRecommendationResponse>('/ai/recommend', { method: 'POST', body }),
  });
}

// ── pricing ─────────────────────────────────────────────────────────────────

export function useServerQuote() {
  return useMutation({
    mutationFn: (input: {
      config: GrillzConfig;
      facialSurfaceAreaMm2: number;
      countryCode?: string;
      expedited?: boolean;
    }) => api<PriceQuote>('/pricing/quote', { method: 'POST', body: input }),
  });
}

// ── orders ──────────────────────────────────────────────────────────────────

export function useOrders() {
  return useQuery({ queryKey: keys.orders, queryFn: () => api<OrderRow[]>('/orders') });
}

export function useOrder(id: string) {
  return useQuery({ queryKey: keys.order(id), queryFn: () => api<OrderRow>(`/orders/${id}`) });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: keys.invoice(id),
    queryFn: () => api<Record<string, unknown>>(`/orders/${id}/invoice`),
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: PlaceOrderDto) =>
      api<{ order: OrderRow; payment: { status: string; clientSecret: string | null } }>(
        '/orders',
        { method: 'POST', body: dto },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.orders });
      void queryClient.invalidateQueries({ queryKey: keys.designs });
    },
  });
}

// ── notifications ───────────────────────────────────────────────────────────

export function useNotifications() {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: () => api<NotificationRow[]>('/notifications'),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: keys.unread,
    queryFn: () => api<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30_000,
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST', body: {} }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.notifications });
      void queryClient.invalidateQueries({ queryKey: keys.unread });
    },
  });
}
