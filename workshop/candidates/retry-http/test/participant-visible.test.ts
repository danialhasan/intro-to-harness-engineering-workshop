import assert from "node:assert/strict";
import { loadCatalog } from "../src/clients/catalog.js";
import { createJob } from "../src/clients/jobs.js";
import { InMemoryTraceSink } from "../src/telemetry.js";
import { FakeClock, ScriptedTransport } from "./scripted-transport.js";

async function expectRejects(action: () => Promise<unknown>): Promise<void> {
  await assert.rejects(action);
}

async function testCatalogReadRetries(): Promise<void> {
  const transport = new ScriptedTransport("catalog.read", [
    { kind: "status", status: 503 },
    { kind: "status", status: 503 },
    { kind: "value", value: [{ sku: "book" }] },
  ]);
  const clock = new FakeClock();
  const trace = new InMemoryTraceSink();

  const catalog = await loadCatalog(() => transport.send(), clock, trace);

  assert.deepEqual(catalog, [{ sku: "book" }]);
  assert.equal(transport.physicalAttempts.length, 3);
  assert.deepEqual(clock.sleeps, [100, 200]);
  assert.equal(trace.traces.length, transport.physicalAttempts.length);
}

async function testJobCreateDoesNotDuplicate(): Promise<void> {
  const transport = new ScriptedTransport("jobs.create", [
    { kind: "commit-then-lose", value: { id: "job-1" } },
    { kind: "commit-then-lose", value: { id: "job-2" } },
  ]);
  const clock = new FakeClock();
  const trace = new InMemoryTraceSink();

  await expectRejects(() => createJob(() => transport.send(), clock, trace));

  assert.equal(transport.committedValues.length, 1);
  assert.equal(transport.physicalAttempts.length, 1);
  assert.equal(trace.traces.length, 1);
}

await testCatalogReadRetries();
await testJobCreateDoesNotDuplicate();
console.log("Participant-visible tests passed.");
