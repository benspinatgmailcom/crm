import { config } from 'dotenv';
import * as path from 'path';
import { z } from 'zod';

// Load .env files before parsing (dev); in production env is usually set by the host
if (process.env.NODE_ENV !== 'production') {
  config({ path: path.resolve(process.cwd(), '../../packages/db/.env') });
  config(); // apps/api/.env
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(3001),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL: z.string().min(1).default('7d'),

  OPENAI_API_KEY: z.string().trim().optional(),
  OPENAI_MODEL: z.string().trim().default('gpt-4o-mini'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).optional(),
  S3_BUCKET_NAME: z.string().trim().optional(),
  S3_BUCKET: z.string().trim().optional(),
  AWS_REGION: z.string().trim().optional(),
  S3_REGION: z.string().trim().optional(),
  S3_KEY_PREFIX: z.string().trim().optional(),
  S3_URL_EXPIRES_SECONDS: z.coerce.number().min(1).max(86400).default(3600),
  S3_ENDPOINT: z.string().trim().optional(),
  AWS_ACCESS_KEY_ID: z.string().trim().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().trim().optional(),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `Environment validation failed:\n${issues}\n\nCheck .env and required variables (see .env.example).`
    );
  }
  return result.data;
}

export const env = parseEnv();

export type Env = z.infer<typeof envSchema>;
