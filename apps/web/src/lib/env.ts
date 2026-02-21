import { z } from "zod";

/**
 * Validates NEXT_PUBLIC_* env at module load.
 * Import this early (e.g. root layout) so the app fails with a readable error if config is invalid.
 */
const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:3001"),
  NEXT_PUBLIC_ACCENT_1: z.string().trim().default(""),
  NEXT_PUBLIC_ACCENT_2: z.string().trim().default(""),
  NEXT_PUBLIC_LOGO_URL: z.string().trim().default(""),
});

function parseEnv() {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_ACCENT_1: process.env.NEXT_PUBLIC_ACCENT_1,
    NEXT_PUBLIC_ACCENT_2: process.env.NEXT_PUBLIC_ACCENT_2,
    NEXT_PUBLIC_LOGO_URL: process.env.NEXT_PUBLIC_LOGO_URL,
  });
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Environment validation failed:\n${issues}\n\nCheck .env.local and NEXT_PUBLIC_* variables (see .env.example).`
    );
  }
  return result.data;
}

export const env = parseEnv();

export type Env = z.infer<typeof envSchema>;
