import { HttpStatusError, type Clock, type RequestSpec } from "../src/http/types.js";
import type { TraceSink } from "../src/telemetry.js";

const MAX_ATTEMPTS = 3;

function isTemporary(error: unknown): boolean {
  return error instanceof HttpStatusError && error.status === 503;
}

export async function requestWithRetry<T>(
  request: RequestSpec<T>,
  clock: Clock,
  trace: TraceSink,
): Promise<T> {
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
      trace.record({
        operation: request.operation,
        method: request.method,
        attempt,
        outcome: "failure",
      });
      const mayRetry = request.retrySafety === "safe" && isTemporary(error);
      if (attempt < MAX_ATTEMPTS && mayRetry) {
        await clock.sleep(attempt * 100);
        continue;
      }
      throw error;
    }
  }

  throw new Error("unreachable retry state");
}
