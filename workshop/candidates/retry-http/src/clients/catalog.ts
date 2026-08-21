import { requestWithRetry } from "../http/request.js";
import type { Clock, RequestSpec } from "../http/types.js";
import type { TraceSink } from "../telemetry.js";

export interface CatalogItem {
  sku: string;
}

export function loadCatalog(
  send: () => Promise<CatalogItem[]>,
  clock: Clock,
  trace: TraceSink,
): Promise<CatalogItem[]> {
  const request: RequestSpec<CatalogItem[]> = {
    operation: "catalog.read",
    method: "GET",
    retrySafety: "safe",
    send,
  };
  return requestWithRetry(request, clock, trace);
}
