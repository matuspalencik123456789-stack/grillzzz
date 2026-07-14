/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@grillz/ui',
    '@grillz/three-engine',
    '@grillz/shared-types',
    '@grillz/pricing-engine',
    '@grillz/cad-engine',
  ],
  output: 'standalone',
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
