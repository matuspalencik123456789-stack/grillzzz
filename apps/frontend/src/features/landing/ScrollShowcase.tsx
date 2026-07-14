'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, useScroll } from 'framer-motion';
import { Button, Skeleton } from '@grillz/ui';
import type { ShowcaseStop } from './GrillzScene';

const GrillzScene = dynamic(() => import('./GrillzScene'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none opacity-30" />,
});

interface Section {
  eyebrow: string;
  title: string;
  body: string;
  align: 'left' | 'right' | 'center';
  stop: ShowcaseStop;
}

const SECTIONS: Section[] = [
  {
    eyebrow: 'Custom dental jewelry, engineered',
    title: 'Your smile, cast in gold',
    body: 'Professional 3D dental scans in. Manufacturing-ready grillz out. Designed by you, in your browser, priced in realtime.',
    align: 'center',
    stop: { color: '#f0c649', roughness: 0.12 }, // 18K
  },
  {
    eyebrow: 'Scan-perfect fit',
    title: 'Built on your real teeth',
    body: 'Upload STL, PLY, OBJ or glTF scans. Our pipeline validates the mesh, detects the jaw and segments every tooth — each one individually selectable in the studio.',
    align: 'left',
    stop: { color: '#e6a17c', roughness: 0.15 }, // rose gold
  },
  {
    eyebrow: 'Materials & stones',
    title: 'From 10K gold to platinum',
    body: 'Seven metals, four finishes, natural or lab diamonds and CZ in four cuts. Every slider updates a manufacturing-accurate 3D preview — and the price — instantly.',
    align: 'right',
    stop: { color: '#e8e6df', roughness: 0.14 }, // white gold
  },
  {
    eyebrow: 'AI-assisted styling',
    title: '“Luxury Miami grillz”',
    body: 'Describe the look and get three manufacturable presets with live price tags, checked against real casting and stone-setting rules before you ever spend a dollar.',
    align: 'left',
    stop: { color: '#e2e4e5', roughness: 0.08 }, // platinum
  },
  {
    eyebrow: 'From click to cast',
    title: 'Order it. Track it. Wear it.',
    body: 'Quote-locked checkout, a production line you follow stage by stage, and manufacturing files (STL, OBJ, glTF + work order PDF) generated the moment you pay.',
    align: 'center',
    stop: { color: '#f0c649', roughness: 0.12 }, // back to gold
  },
];

export function ScrollShowcase({ authed }: { authed: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  return (
    <div ref={containerRef} className="relative">
      {/* scroll progress hairline */}
      <motion.div
        className="fixed inset-x-0 top-0 z-50 h-px origin-left bg-gradient-to-r from-gold-500 to-gold-200"
        style={{ scaleX: scrollYProgress }}
      />

      {/* sticky 3D stage behind the copy */}
      <div className="sticky top-0 h-screen w-full">
        <GrillzScene progress={scrollYProgress} stops={SECTIONS.map((s) => s.stop)} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/70 via-transparent to-background/80" />
      </div>

      {/* copy sections scroll over the stage */}
      <div className="relative z-10 -mt-[100vh]">
        {SECTIONS.map((section, index) => (
          <section
            key={section.title}
            className={`flex h-screen px-6 md:px-16 ${
              section.align === 'center'
                ? 'items-end justify-center pb-16 text-center md:pb-24'
                : section.align === 'right'
                  ? 'items-center justify-end text-right'
                  : 'items-center justify-start text-left'
            }`}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ amount: 0.5, once: false }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="glass max-w-xl rounded-2xl p-8 md:p-10"
            >
              <p className="mb-3 text-xs uppercase tracking-[0.35em] text-gold-400/90">
                {section.eyebrow}
              </p>
              <h2 className="font-display text-4xl leading-tight md:text-5xl">
                {section.title}
              </h2>
              <p className="mt-4 text-balance leading-relaxed text-muted-foreground">
                {section.body}
              </p>
              {index === 0 && (
                <p className="mt-6 animate-pulse text-xs text-muted-foreground">
                  scroll to spin ↓
                </p>
              )}
              {index === SECTIONS.length - 1 && (
                <div
                  className={`mt-8 flex gap-4 ${section.align === 'center' ? 'justify-center' : ''}`}
                >
                  <Link href={authed ? '/dashboard' : '/register'}>
                    <Button variant="gold" size="lg">
                      Start designing
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="outline" size="lg">
                      Sign in
                    </Button>
                  </Link>
                </div>
              )}
            </motion.div>
          </section>
        ))}
      </div>
    </div>
  );
}
