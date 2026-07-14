import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Local dev/self-hosted: pull env from the monorepo root .env (Next only
// auto-loads .env from the app directory). Real env vars always win —
// dotenv never overrides values that are already set.
const appDir = dirname(fileURLToPath(import.meta.url));
for (const candidate of [resolve(appDir, '../../.env'), join(appDir, '.env')]) {
  if (existsSync(candidate)) loadDotenv({ path: candidate });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Only source-distributed TS packages belong here. Compiled CJS workspace
  // packages (shared-types, pricing-engine, cad-engine, database) must NOT be
  // transpiled: next dev's react-refresh loader injects import.meta.webpackHot
  // into transpiled modules, which is a parse error in CommonJS files.
  transpilePackages: ['@grillz/ui', '@grillz/three-engine'],
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
