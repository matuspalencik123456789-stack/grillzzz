import { PrismaClient, MaterialType, PatternKind } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

// Matches apps/backend PasswordService (scrypt, N=16384 default of Node scryptSync).
function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plain, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

const MATERIALS: Array<{
  type: MaterialType;
  name: string;
  densityGCm3: number;
  pricePerGram: number; // cents
  colorHex: string;
  metalness: number;
  roughness: number;
}> = [
  { type: 'GOLD_10K', name: '10K Gold', densityGCm3: 11.6, pricePerGram: 3450, colorHex: '#d9b45b', metalness: 1, roughness: 0.18 },
  { type: 'GOLD_14K', name: '14K Gold', densityGCm3: 13.1, pricePerGram: 4780, colorHex: '#e3bd58', metalness: 1, roughness: 0.15 },
  { type: 'GOLD_18K', name: '18K Gold', densityGCm3: 15.6, pricePerGram: 6120, colorHex: '#f0c649', metalness: 1, roughness: 0.12 },
  { type: 'WHITE_GOLD', name: '14K White Gold', densityGCm3: 14.0, pricePerGram: 5150, colorHex: '#e8e6df', metalness: 1, roughness: 0.14 },
  { type: 'ROSE_GOLD', name: '14K Rose Gold', densityGCm3: 13.0, pricePerGram: 4890, colorHex: '#e6a17c', metalness: 1, roughness: 0.15 },
  { type: 'SILVER', name: 'Sterling Silver', densityGCm3: 10.36, pricePerGram: 210, colorHex: '#d8d8d8', metalness: 1, roughness: 0.2 },
  { type: 'PLATINUM', name: 'Platinum 950', densityGCm3: 21.45, pricePerGram: 6890, colorHex: '#e2e4e5', metalness: 1, roughness: 0.1 },
];

const PATTERNS: Array<{
  kind: PatternKind;
  name: string;
  description: string;
  params: Record<string, unknown>;
  laborFactor: number;
}> = [
  { kind: 'CLASSIC', name: 'Classic', description: 'Clean polished surface, no relief.', params: {}, laborFactor: 1 },
  { kind: 'HONEYCOMB', name: 'Honeycomb', description: 'Hexagonal relief cells across the facial surface.', params: { cellMm: 1.2, depthMm: 0.15 }, laborFactor: 1.35 },
  { kind: 'BAGUETTE', name: 'Baguette', description: 'Channel-set baguette layout with linear geometry.', params: { channelWidthMm: 2.0 }, laborFactor: 1.6 },
  { kind: 'FLOODED', name: 'Flooded', description: 'Full pavé coverage edge to edge.', params: { coverage: 0.95 }, laborFactor: 1.9 },
  { kind: 'ICED', name: 'Iced', description: 'Dense pavé on facial surfaces with polished margins.', params: { coverage: 0.75 }, laborFactor: 1.7 },
  { kind: 'SNAKE', name: 'Snake', description: 'Engraved scale texture with serpentine flow.', params: { scaleMm: 1.0, depthMm: 0.12 }, laborFactor: 1.45 },
  { kind: 'FLAME', name: 'Flame', description: 'Hand-finished flame engraving.', params: { depthMm: 0.14 }, laborFactor: 1.5 },
  { kind: 'CUSTOM_ENGRAVING', name: 'Custom Engraving', description: 'Free-form text or artwork engraving.', params: { maxChars: 24 }, laborFactor: 1.4 },
];

async function main() {
  for (const m of MATERIALS) {
    await prisma.material.upsert({ where: { type: m.type }, update: m, create: m });
  }
  for (const p of PATTERNS) {
    await prisma.pattern.upsert({ where: { kind: p.kind }, update: p, create: p });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@grillz.studio';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin-dev-password';
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Studio Admin',
      role: 'ADMIN',
      emailVerified: new Date(),
      passwordHash: hashPassword(adminPassword),
    },
  });

  // deterministic id for idempotent re-seeding of the demo manufacturer
  const orgSlug = 'grillz-studio-lab';
  await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: {},
    create: { name: 'Grillz Studio Lab', slug: orgSlug, type: 'MANUFACTURER' },
  });

  console.log(
    `Seeded ${MATERIALS.length} materials, ${PATTERNS.length} patterns, admin ${adminEmail}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
