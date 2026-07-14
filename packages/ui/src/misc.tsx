'use client';

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

// ── Badge ────────────────────────────────────────────────────────────────────

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/15 text-primary',
        gold: 'border-gold-500/30 bg-gold-500/10 text-gold-300',
        success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
        destructive: 'border-red-500/30 bg-red-500/10 text-red-400',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// ── Switch ───────────────────────────────────────────────────────────────────

export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-gold-500 data-[state=unchecked]:bg-input',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
  </SwitchPrimitive.Root>
));
Switch.displayName = 'Switch';

// ── Skeleton ─────────────────────────────────────────────────────────────────

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

// ── Separator ────────────────────────────────────────────────────────────────

export function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      role="separator"
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
}
