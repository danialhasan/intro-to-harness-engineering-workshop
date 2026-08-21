export type ImportRecord = { id: string; value: string };

export type ImportPlan = {
  endpoint: string;
  headers: Record<string, string>;
  batches: ImportRecord[][];
};

export function buildImportPlan(records: ImportRecord[], tenantId: string): ImportPlan {
  return {
    endpoint: "/records",
    headers: { tenant: tenantId },
    batches: records.length === 0 ? [] : [records],
  };
}
