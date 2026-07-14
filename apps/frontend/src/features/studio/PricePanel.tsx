'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_PRICE_BOOK, computeQuote, estimateFacialAreaMm2 } from '@grillz/pricing-engine';
import type { PriceQuote } from '@grillz/shared-types';
import { Badge, Skeleton } from '@grillz/ui';
import { useServerQuote } from '@/features/api/hooks';
import { formatMoney } from '@/lib/format';
import { useStudioStore } from './store';
import type { ToothRow } from '@/features/api/types';

export interface PricePanelProps {
  scanTeeth: ToothRow[];
  onQuote: (quote: PriceQuote | null) => void;
}

/**
 * Realtime price: every config change is priced instantly with the local
 * pricing engine (same code as the server), then an authoritative server
 * quote — reflecting live admin price-book overrides — replaces it after a
 * 500 ms debounce. The checkout button only unlocks on a server quote.
 */
export function PricePanel({ scanTeeth, onQuote }: PricePanelProps) {
  const config = useStudioStore((s) => s.config);
  const serverQuote = useServerQuote();
  const [authoritative, setAuthoritative] = useState<PriceQuote | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const facialArea = useMemo(() => {
    const byFdi = new Map(scanTeeth.map((t) => [t.fdiNumber, t.surfaceAreaMm2]));
    let known = 0;
    let missing = 0;
    for (const fdi of config.toothNumbers) {
      const area = byFdi.get(fdi);
      if (area) known += area;
      else missing++;
    }
    return known + estimateFacialAreaMm2(missing);
  }, [scanTeeth, config.toothNumbers]);

  const localQuote = useMemo(
    () =>
      computeQuote(
        { config, facialSurfaceAreaMm2: facialArea, countryCode: 'US', expedited: false },
        DEFAULT_PRICE_BOOK,
      ),
    [config, facialArea],
  );

  useEffect(() => {
    setAuthoritative(null);
    onQuote(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      serverQuote.mutate(
        { config, facialSurfaceAreaMm2: facialArea, countryCode: 'US', expedited: false },
        {
          onSuccess: (quote) => {
            setAuthoritative(quote);
            onQuote(quote);
          },
        },
      );
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // serverQuote/onQuote identities are stable enough; keying on inputs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, facialArea]);

  const quote = authoritative ?? localQuote;

  return (
    <div className="glass rounded-lg p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Price
        </span>
        {authoritative ? (
          <Badge variant="success">confirmed</Badge>
        ) : (
          <Badge variant="outline">estimating…</Badge>
        )}
      </div>
      <div className="space-y-1.5">
        {quote.lineItems.map((item) => (
          <div key={item.code} className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {item.label}
              {item.detail && <span className="ml-1 text-xs opacity-60">({item.detail})</span>}
            </span>
            <span>{formatMoney(item.amountMinor)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t border-border/60 pt-3">
        <span className="font-medium">Total</span>
        {serverQuote.isPending && !authoritative ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <span className="font-display text-2xl text-gold-300">
            {formatMoney(quote.totalMinor)}
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {quote.computed.metalWeightGrams.toFixed(1)} g metal · {quote.computed.stoneCount} stones ·{' '}
        {quote.computed.laborHours.toFixed(1)} h labor
      </p>
    </div>
  );
}
