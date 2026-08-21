import { HttpStatusError, type Clock, type RequestSpec } from "./types.js";
import type { TraceSink } from "../telemetry.js";

const MAX_ATTEMPTS = 3;

function isTemporary(error: unknown): boolean {
  // The bug is realistic: the helper knows only transport-level failure
  // classes. A lost response looks retryable here even when repeating the
  // operation is unsafe.
  return !(error instanceof HttpStatusError) || error.status >= 500;
}

/**
 * Starting implementation: this is a common but unsafe retry helper.
 * It treats every retryable-looking failure as a transport concern and only
 * emits a summary trace after the operation ends.
 */
export async function requestWithRetry<T>(
  request: RequestSpec<T>,
  clock: Clock,
  trace: TraceSink,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const value = await request.send();
      trace.record({
        operation: request.operation,
        method: request.method,
        attempt,
        outcome: "success",
      });
      return value;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS && isTemporary(error)) {
        await clock.sleep(attempt * 100);
        continue;
      }

      trace.record({
        operation: request.operation,
        method: request.method,
        attempt,
        outcome: "failure",
      });
      throw error;
    }
  }

  throw lastError;
}
