export type ImportRecord = { id: string; value: string };

export type ImportPlan = {
  endpoint: string;
  headers: Record<string, string>;
  batches: ImportRecord[][];
};

export function buildImportPlan(records: ImportRecord[], tenantId: string): ImportPlan {
  if (tenantId.trim() === "") throw new Error("tenant ID is required");
  const batches: ImportRecord[][] = [];
  for (let index = 0; index < records.length; index += 50) {
    batches.push(records.slice(index, index + 50));
  }
  return { endpoint: "/v2/records", headers: { "x-tenant-id": tenantId }, batches };
}
