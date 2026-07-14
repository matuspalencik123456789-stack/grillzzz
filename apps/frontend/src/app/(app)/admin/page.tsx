'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ProductionStage } from '@grillz/shared-types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@grillz/ui';
import { api } from '@/lib/api-client';
import { formatDate, formatMoney } from '@/lib/format';

interface Analytics {
  totals: {
    users: number;
    projects: number;
    readyScans: number;
    orders: number;
    revenueMinor: number;
    ordersLast30d: number;
  };
  productionByStage: Record<string, number>;
  popularMaterials: Array<{ material: string; designs: number }>;
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { projects: number; orders: number };
}

interface AdminOrder {
  id: string;
  number: string;
  status: string;
  totalMinor: number;
  placedAt: string;
  user: { email: string };
  productionJob: { id: string; stage: ProductionStage } | null;
}

interface ProductionJob {
  id: string;
  stage: ProductionStage;
  priority: number;
  createdAt: string;
  order: {
    number: string;
    user: { email: string };
    items: Array<{ grillz: { name: string; material: { name: string } } }>;
  };
}

interface AdminMaterial {
  id: string;
  type: string;
  name: string;
  pricePerGram: number;
  isActive: boolean;
}

const NEXT_STAGE: Partial<Record<ProductionStage, ProductionStage>> = {
  QUEUED: 'CAD_REVIEW',
  CAD_REVIEW: 'PRINTING',
  PRINTING: 'CASTING',
  CASTING: 'STONE_SETTING',
  STONE_SETTING: 'POLISHING',
  POLISHING: 'QUALITY_CONTROL',
  QUALITY_CONTROL: 'SHIPPED',
};

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-8 font-display text-3xl">Admin</h1>
      <Tabs defaultValue="analytics">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="orders"><OrdersTab /></TabsContent>
        <TabsContent value="production"><ProductionTab /></TabsContent>
        <TabsContent value="pricing"><PricingTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function AnalyticsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () => api<Analytics>('/admin/analytics'),
  });
  if (isLoading || !data) return <Skeleton className="h-64" />;

  const stats = [
    { label: 'Revenue', value: formatMoney(data.totals.revenueMinor) },
    { label: 'Orders', value: String(data.totals.orders) },
    { label: 'Orders (30d)', value: String(data.totals.ordersLast30d) },
    { label: 'Users', value: String(data.totals.users) },
    { label: 'Projects', value: String(data.totals.projects) },
    { label: 'Processed scans', value: String(data.totals.readyScans) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-1 font-display text-xl text-gold-300">{stat.value}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Production pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(data.productionByStage).length === 0 && (
              <p className="text-sm text-muted-foreground">Queue is empty.</p>
            )}
            {Object.entries(data.productionByStage).map(([stage, count]) => (
              <div key={stage} className="flex justify-between text-sm">
                <span className="capitalize text-muted-foreground">{stage.replace(/_/g, ' ').toLowerCase()}</span>
                <span>{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Popular materials</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.popularMaterials.map((entry) => (
              <div key={entry.material} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{entry.material}</span>
                <span>{entry.designs} designs</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UsersTab() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: () =>
      api<{ items: AdminUser[]; total: number }>(
        `/admin/users?page=1&pageSize=50${query ? `&q=${encodeURIComponent(query)}` : ''}`,
      ),
  });
  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api(`/admin/users/${id}/active`, { method: 'PATCH', body: { isActive } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by email or name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />
      {isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-2">
          {data.items.map((user) => (
            <Card key={user.id} className="flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.name ?? '—'}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <Badge variant={user.role === 'ADMIN' ? 'gold' : 'outline'}>{user.role.toLowerCase()}</Badge>
              <span className="text-xs text-muted-foreground">
                {user._count.projects}p · {user._count.orders}o
              </span>
              <Button
                variant={user.isActive ? 'outline' : 'secondary'}
                size="sm"
                onClick={() => setActive.mutate({ id: user.id, isActive: !user.isActive })}
              >
                {user.isActive ? 'Disable' : 'Enable'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function OrdersTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders'],
    queryFn: () => api<{ items: AdminOrder[] }>('/admin/orders?page=1&pageSize=50'),
  });
  if (isLoading || !data) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-2">
      {data.items.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">No orders.</Card>
      )}
      {data.items.map((order) => (
        <Card key={order.id} className="flex items-center gap-4 p-4 text-sm">
          <span className="font-mono">{order.number}</span>
          <span className="truncate text-muted-foreground">{order.user.email}</span>
          <Badge variant="outline">{order.status.replace(/_/g, ' ').toLowerCase()}</Badge>
          {order.productionJob && (
            <Badge variant="gold">{order.productionJob.stage.replace(/_/g, ' ').toLowerCase()}</Badge>
          )}
          <span className="ml-auto text-gold-300">{formatMoney(order.totalMinor)}</span>
          <span className="text-xs text-muted-foreground">{formatDate(order.placedAt)}</span>
        </Card>
      ))}
    </div>
  );
}

function ProductionTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'production'],
    queryFn: () => api<ProductionJob[]>('/production/queue'),
  });
  const advance = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: ProductionStage }) =>
      api(`/production/jobs/${id}/advance`, { method: 'POST', body: { stage } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'production'] }),
  });

  if (isLoading || !data) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-2">
      {data.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">Production queue is empty.</Card>
      )}
      {data.map((job) => {
        const next = NEXT_STAGE[job.stage];
        return (
          <Card key={job.id} className="flex items-center gap-4 p-4 text-sm">
            <span className="font-mono">{job.order.number}</span>
            <span className="truncate text-muted-foreground">
              {job.order.items.map((i) => `${i.grillz.name} (${i.grillz.material.name})`).join(', ')}
            </span>
            <Badge variant="gold">{job.stage.replace(/_/g, ' ').toLowerCase()}</Badge>
            {next && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                disabled={advance.isPending}
                onClick={() => advance.mutate({ id: job.id, stage: next })}
              >
                → {next.replace(/_/g, ' ').toLowerCase()}
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function PricingTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'materials'],
    queryFn: () => api<AdminMaterial[]>('/catalog/materials'),
  });
  const update = useMutation({
    mutationFn: ({ type, pricePerGram }: { type: string; pricePerGram: number }) =>
      api(`/admin/materials/${type}`, { method: 'PATCH', body: { pricePerGram } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'materials'] }),
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (isLoading || !data) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Prices are per gram, in cents. Changes version the price book — outstanding quotes
        re-verify at order time.
      </p>
      {data.map((material) => (
        <Card key={material.id} className="flex items-center gap-4 p-4 text-sm">
          <span className="w-40">{material.name}</span>
          <Input
            className="w-32 font-mono"
            value={drafts[material.type] ?? String(material.pricePerGram)}
            onChange={(e) => setDrafts((d) => ({ ...d, [material.type]: e.target.value }))}
          />
          <span className="text-xs text-muted-foreground">
            = {formatMoney(Number(drafts[material.type] ?? material.pricePerGram) || 0)}/g
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            disabled={update.isPending}
            onClick={() => {
              const value = Number(drafts[material.type] ?? material.pricePerGram);
              if (Number.isInteger(value) && value > 0) {
                update.mutate({ type: material.type, pricePerGram: value });
              }
            }}
          >
            Save
          </Button>
        </Card>
      ))}
    </div>
  );
}
