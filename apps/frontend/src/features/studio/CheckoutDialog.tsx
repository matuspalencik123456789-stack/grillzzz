'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { shippingAddressSchema, type PriceQuote, type ShippingAddress } from '@grillz/shared-types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@grillz/ui';
import { usePlaceOrder } from '@/features/api/hooks';
import { formatMoney } from '@/lib/format';

export interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grillzId: string;
  quote: PriceQuote | null;
}

export function CheckoutDialog({ open, onOpenChange, grillzId, quote }: CheckoutDialogProps) {
  const router = useRouter();
  const placeOrder = usePlaceOrder();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ShippingAddress>({
    resolver: zodResolver(shippingAddressSchema),
    defaultValues: { countryCode: 'US' },
  });

  const onSubmit = handleSubmit(async (address) => {
    if (!quote) return;
    setError(null);
    try {
      const result = await placeOrder.mutateAsync({
        grillzId,
        quote,
        shippingAddress: address,
      });
      router.push(`/orders/${result.order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Place order</DialogTitle>
          <DialogDescription>
            {quote
              ? `Total ${formatMoney(quote.totalMinor)} — locked to the confirmed quote.`
              : 'Waiting for a confirmed quote…'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" {...register('fullName')} />
            {errors.fullName && <p className="text-xs text-red-400">{errors.fullName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="line1">Address line 1</Label>
            <Input id="line1" {...register('line1')} />
            {errors.line1 && <p className="text-xs text-red-400">{errors.line1.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="line2">Address line 2 (optional)</Label>
            <Input id="line2" {...register('line2')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" {...register('city')} />
              {errors.city && <p className="text-xs text-red-400">{errors.city.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" {...register('state')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" {...register('postalCode')} />
              {errors.postalCode && (
                <p className="text-xs text-red-400">{errors.postalCode.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="countryCode">Country (ISO)</Label>
              <Input id="countryCode" maxLength={2} {...register('countryCode')} />
              {errors.countryCode && (
                <p className="text-xs text-red-400">{errors.countryCode.message}</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" {...register('phone')} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button
            type="submit"
            variant="gold"
            className="w-full"
            disabled={!quote || placeOrder.isPending}
          >
            {placeOrder.isPending
              ? 'Placing order…'
              : quote
                ? `Pay ${formatMoney(quote.totalMinor)}`
                : 'Waiting for quote…'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
