'use client';

import Link from 'next/link';
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@grillz/ui';
import { useOrders } from '@/features/api/hooks';
import { formatDate, formatMoney } from '@/lib/format';

const STATUS_VARIANT = {
  PENDING_PAYMENT: 'warning',
  PAID: 'default',
  IN_PRODUCTION: 'gold',
  QUALITY_CHECK: 'gold',
  SHIPPED: 'success',
  DELIVERED: 'success',
  CANCELLED: 'outline',
  REFUNDED: 'outline',
} as const;

export default function OrdersPage() {
  const { data: orders, isLoading } = useOrders();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-8 font-display text-3xl">Orders</h1>
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : !orders || orders.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No orders yet — price a design in the studio and hit Order.
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`} className="block">
              <Card className="transition-colors hover:border-gold-500/30">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="font-mono text-base">{order.number}</CardTitle>
                  <Badge variant={STATUS_VARIANT[order.status] ?? 'outline'}>
                    {order.status.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                </CardHeader>
                <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{order.items.map((i) => i.grillz.name).join(', ')}</span>
                  {order.productionJob && (
                    <Badge variant="outline">
                      {order.productionJob.stage.replace(/_/g, ' ').toLowerCase()}
                    </Badge>
                  )}
                  <span className="ml-auto text-gold-300">{formatMoney(order.totalMinor)}</span>
                  <span className="text-xs">{formatDate(order.placedAt)}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
