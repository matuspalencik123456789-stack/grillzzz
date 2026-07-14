'use client';

import Link from 'next/link';
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@grillz/ui';
import { useDesigns, useToggleFavorite } from '@/features/api/hooks';
import { formatDate, formatMoney } from '@/lib/format';

export default function DesignsPage() {
  const { data: designs, isLoading } = useDesigns();
  const toggleFavorite = useToggleFavorite();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-8 font-display text-3xl">Saved designs</h1>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !designs || designs.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Nothing saved yet — designs you create in the studio appear here.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {designs.map((design) => (
            <Card key={design.id} className="transition-colors hover:border-gold-500/30">
              <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                <Link href={`/studio/${design.id}`}>
                  <CardTitle className="text-base hover:text-gold-200">{design.name}</CardTitle>
                </Link>
                <button
                  aria-label="Toggle favorite"
                  className="text-muted-foreground transition-colors hover:text-gold-300"
                  onClick={() => toggleFavorite.mutate(design.id)}
                >
                  ♥
                </button>
              </CardHeader>
              <CardContent className="flex items-center gap-3 text-xs text-muted-foreground">
                <Badge variant="outline">{design.setType.replace('_', ' ').toLowerCase()}</Badge>
                <span>{design.material.name}</span>
                {design.priceSnapshot && (
                  <span className="text-gold-300">{formatMoney(design.priceSnapshot.totalMinor)}</span>
                )}
                <span className="ml-auto">{formatDate(design.updatedAt)}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
