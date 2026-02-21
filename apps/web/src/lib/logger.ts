/**
 * Server-side error logging. No vendor required; extend here for Sentry etc.
 * Use in API routes, Server Components, or server actions to log errors.
 */
export function logServerError(
  message: string,
  error?: unknown,
  context?: Record<string, unknown>
): void {
  const payload = {
    message,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  };
  console.error("[server error]", JSON.stringify(payload));
}
