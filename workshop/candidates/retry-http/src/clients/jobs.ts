import { requestWithRetry } from "../http/request.js";
import type { Clock, RequestSpec } from "../http/types.js";
import type { TraceSink } from "../telemetry.js";

export interface Job {
  id: string;
}

export function createJob(
  send: () => Promise<Job>,
  clock: Clock,
  trace: TraceSink,
): Promise<Job> {
  const request: RequestSpec<Job> = {
    operation: "jobs.create",
    method: "POST",
    retrySafety: "unsafe",
    send,
  };
  return requestWithRetry(request, clock, trace);
}
