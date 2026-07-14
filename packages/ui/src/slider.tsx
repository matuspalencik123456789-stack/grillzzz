'use client';

import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from './cn';

export const Slider = forwardRef<
  ElementRef<typeof SliderPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex w-full touch-none select-none items-center', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
      <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-gold-500 to-gold-300" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border border-gold-300/60 bg-zinc-100 shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = 'Slider';
