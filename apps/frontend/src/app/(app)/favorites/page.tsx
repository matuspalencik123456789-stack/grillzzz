'use client';

import Link from 'next/link';
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@grillz/ui';
import { useFavorites, useToggleFavorite } from '@/features/api/hooks';
import { formatMoney } from '@/lib/format';

export default function FavoritesPage() {
  const { data: favorites, isLoading } = useFavorites();
  const toggleFavorite = useToggleFavorite();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-8 font-display text-3xl">Favorites</h1>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !favorites || favorites.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No favorites yet — tap ♥ on any saved design.
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {favorites.map(({ id, grillz }) => (
            <Card key={id} className="transition-colors hover:border-gold-500/30">
              <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                <Link href={`/studio/${grillz.id}`}>
                  <CardTitle className="text-base hover:text-gold-200">{grillz.name}</CardTitle>
                </Link>
                <button
                  aria-label="Remove favorite"
                  className="text-gold-300 hover:text-muted-foreground"
                  onClick={() => toggleFavorite.mutate(grillz.id)}
                >
                  ♥
                </button>
              </CardHeader>
              <CardContent className="flex items-center gap-3 text-xs text-muted-foreground">
                <Badge variant="outline">{grillz.material.name}</Badge>
                <span>{grillz.toothNumbers.length} teeth</span>
                {grillz.priceSnapshot && (
                  <span className="text-gold-300">{formatMoney(grillz.priceSnapshot.totalMinor)}</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
