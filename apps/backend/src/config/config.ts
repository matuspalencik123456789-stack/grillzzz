import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Zod-validated environment. The process refuses to boot on invalid config —
 * misconfiguration fails loudly at deploy time, not at first request.
 *
 * Local dev reads the monorepo-root .env (cwd is apps/backend); containers
 * and CI provide real environment variables, which always take precedence —
 * dotenv never overrides existing process.env values.
 */
function loadEnvFiles(): void {
  for (const candidate of [resolve(process.cwd(), '../../.env'), resolve(process.cwd(), '.env')]) {
    if (existsSync(candidate)) loadDotenv({ path: candidate });
  }
}
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(4000),
  API_CORS_ORIGIN: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(1).default('grillz-studio'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  /** shared secret for trusted server-to-server calls from the Next.js host */
  AUTH_SECRET: z.string().min(32).optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  /** public frontend origin used in email links */
  APP_URL: z.string().default('http://localhost:3000'),
  /** empty key ⇒ emails are logged to stdout instead of sent (dev fallback) */
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('Grillz Studio <no-reply@grillz.studio>'),

  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('claude-sonnet-5'),
});

export type AppConfig = z.infer<typeof envSchema>;

let cached: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (!cached) {
    loadEnvFiles();
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((i) => `  ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid environment configuration:\n${details}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export const CONFIG = 'APP_CONFIG' as const;
