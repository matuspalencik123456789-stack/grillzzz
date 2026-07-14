'use client';

import type { PriceQuote, ProductionStage, ShippingAddress } from '@grillz/shared-types';
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@grillz/ui';
import { useOrder } from '@/features/api/hooks';
import { formatDate, formatMoney } from '@/lib/format';

const STAGES: ProductionStage[] = [
  'QUEUED',
  'CAD_REVIEW',
  'PRINTING',
  'CASTING',
  'STONE_SETTING',
  'POLISHING',
  'QUALITY_CONTROL',
  'SHIPPED',
];

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const { data: order, isLoading } = useOrder(params.id);

  if (isLoading || !order) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  const invoiceQuote = (order as unknown as { quoteJson?: PriceQuote }).quoteJson ?? null;
  const address = (order as unknown as { shippingAddress?: ShippingAddress }).shippingAddress;
  const stageIndex = order.productionJob ? STAGES.indexOf(order.productionJob.stage) : -1;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center gap-4">
        <h1 className="font-mono text-2xl">{order.number}</h1>
        <Badge variant="gold">{order.status.replace(/_/g, ' ').toLowerCase()}</Badge>
        <span className="ml-auto text-sm text-muted-foreground">{formatDate(order.placedAt)}</span>
      </div>

      {order.productionJob && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Production</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-wrap gap-2">
              {STAGES.map((stage, index) => (
                <li
                  key={stage}
                  className={`rounded-md px-2.5 py-1 text-xs ${
                    index < stageIndex
                      ? 'bg-gold-500/10 text-gold-400'
                      : index === stageIndex
                        ? 'bg-gold-500/25 font-medium text-gold-200'
                        : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {stage.replace(/_/g, ' ').toLowerCase()}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Invoice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span>{item.grillz.name}</span>
              <span>{formatMoney(item.unitPriceMinor)}</span>
            </div>
          ))}
          {invoiceQuote?.lineItems
            .filter((li) => li.code === 'SHIPPING' || li.code === 'TAX')
            .map((li) => (
              <div key={li.code} className="flex justify-between text-muted-foreground">
                <span>{li.label}</span>
                <span>{formatMoney(li.amountMinor)}</span>
              </div>
            ))}
          {!invoiceQuote && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>{formatMoney(order.shippingMinor)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span>{formatMoney(order.taxMinor)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-border/60 pt-2 font-medium">
            <span>Total</span>
            <span className="text-gold-300">{formatMoney(order.totalMinor)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {order.payments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between">
                <span className="capitalize text-muted-foreground">{payment.provider}</span>
                <Badge
                  variant={
                    payment.status === 'SUCCEEDED'
                      ? 'success'
                      : payment.status === 'FAILED'
                        ? 'destructive'
                        : 'warning'
                  }
                >
                  {payment.status.toLowerCase()}
                </Badge>
                <span>{formatMoney(payment.amountMinor)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        {address && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ships to</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>{address.fullName}</p>
              <p>{address.line1}</p>
              {address.line2 && <p>{address.line2}</p>}
              <p>
                {address.city}
                {address.state ? `, ${address.state}` : ''} {address.postalCode}
              </p>
              <p>{address.countryCode}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
