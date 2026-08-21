import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { requestWithRetry as participantRequest } from "../src/http/request.js";
import { requestWithRetry as referenceRequest } from "../reference/request.js";
import {
  HttpStatusError,
  ResponseLostAfterCommitError,
  type Clock,
  type RequestSpec,
} from "../src/http/types.js";
import { InMemoryTraceSink, type TraceSink } from "../src/telemetry.js";
import {
  EvaluatorFakeClock,
  EvaluatorScriptedTransport,
  type ErrorFactories,
} from "./fixtures.js";

type RequestFunction = <T>(
  request: RequestSpec<T>,
  clock: Clock,
  trace: TraceSink,
) => Promise<T>;

type Check = { id: string; name: string; pass: boolean; detail: string };

type Options = {
  target: "participant" | "reference";
  task?: string;
  runDir?: string;
  reportPath?: string;
  implementationPath?: string;
};

type EvaluationTarget = Options["target"] | "implementation-path";

type EvaluationReport = {
  schema_version: "workshop-eval/v1";
  evaluator_version: string;
  task: string | null;
  run_dir: string | null;
  target: EvaluationTarget;
  completion_status: "COMPLETE" | "FAILED";
  hard_gates: Array<{
    id: string;
    status: "PASS" | "FAIL";
    detail: string;
  }>;
  checks: Array<{
    id: string;
    name: string;
    status: "PASS" | "FAIL";
    detail: string;
  }>;
};

const EVALUATOR_VERSION = "retry-http-evaluator/2.0.0";

function parseOptions(argv: string[]): Options {
  const options: Options = { target: "participant" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === "--target") {
      if (value !== "participant" && value !== "reference") {
        throw new Error("--target must be participant or reference");
      }
      options.target = value;
    } else if (argument === "--task") {
      if (value === undefined) throw new Error("--task requires a value");
      options.task = value;
    } else if (argument === "--run-dir") {
      if (value === undefined) throw new Error("--run-dir requires a value");
      options.runDir = value;
    } else if (argument === "--report") {
      if (value === undefined || !isAbsolute(value)) {
        throw new Error("--report requires an absolute path");
      }
      options.reportPath = value;
    } else if (argument === "--implementation-path") {
      if (value === undefined || !isAbsolute(value)) {
        throw new Error("--implementation-path requires an absolute path");
      }
      options.implementationPath = value;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
    index += 1;
  }
  return options;
}

function candidateErrorFactories(): ErrorFactories {
  return {
    createStatusError: (status) => new HttpStatusError(status),
    createResponseLostError: () => new ResponseLostAfterCommitError(),
  };
}

async function loadImplementation(options: Options): Promise<{
  implementation: RequestFunction;
  errors: ErrorFactories;
  target: EvaluationTarget;
}> {
  if (options.implementationPath === undefined) {
    return {
      implementation: options.target === "reference" ? referenceRequest : participantRequest,
      errors: candidateErrorFactories(),
      target: options.target,
    };
  }

  const importedImplementation = await import(pathToFileURL(options.implementationPath).href);
  const importedTypes = await import(
    pathToFileURL(resolve(dirname(options.implementationPath), "types.ts")).href,
  );
  if (typeof importedImplementation.requestWithRetry !== "function") {
    throw new Error("--implementation-path module must export requestWithRetry");
  }
  if (
    typeof importedTypes.HttpStatusError !== "function" ||
    typeof importedTypes.ResponseLostAfterCommitError !== "function"
  ) {
    throw new Error("--implementation-path sibling types.ts must export the HTTP error classes");
  }

  return {
    implementation: importedImplementation.requestWithRetry as RequestFunction,
    errors: {
      createStatusError: (status) => new importedTypes.HttpStatusError(status),
      createResponseLostError: () => new importedTypes.ResponseLostAfterCommitError(),
    },
    target: "implementation-path",
  };
}

async function runCheck(id: string, name: string, action: () => Promise<void>): Promise<Check> {
  try {
    await action();
    return { id, name, pass: true, detail: "PASS" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { id, name, pass: false, detail };
  }
}

async function evaluate(implementation: RequestFunction, errors: ErrorFactories): Promise<Check[]> {
  const safeGet = await runCheck("safe_get_retry", "safe GET retries with bounded backoff", async () => {
    const transport = new EvaluatorScriptedTransport("catalog.read", [
      { kind: "status", status: 503 },
      { kind: "status", status: 503 },
      { kind: "value", value: { sku: "book" } },
    ], errors);
    const clock = new EvaluatorFakeClock();
    const trace = new InMemoryTraceSink();
    const request: RequestSpec<{ sku: string }> = {
      operation: "catalog.read",
      method: "GET",
      retrySafety: "safe",
      send: () => transport.send(),
    };

    assert.deepEqual(await implementation(request, clock, trace), { sku: "book" });
    assert.equal(transport.physicalAttempts.length, 3, "GET must use exactly three physical attempts");
    assert.deepEqual(clock.sleeps, [100, 200], "GET must use bounded fake-clock backoff");
    assert.equal(trace.traces.length, 3, "GET needs one trace record per physical attempt");
    assert.deepEqual(trace.traces.map((entry) => entry.attempt), [1, 2, 3]);
  });

  const unsafePost = await runCheck("unsafe_post_no_duplicate", "unsafe POST does not duplicate a committed job", async () => {
    const transport = new EvaluatorScriptedTransport("jobs.create", [
      { kind: "commit-then-lose", value: { id: "job-1" } },
      { kind: "commit-then-lose", value: { id: "job-2" } },
    ], errors);
    const clock = new EvaluatorFakeClock();
    const trace = new InMemoryTraceSink();
    const request: RequestSpec<{ id: string }> = {
      operation: "jobs.create",
      method: "POST",
      retrySafety: "unsafe",
      send: () => transport.send(),
    };

    await assert.rejects(() => implementation(request, clock, trace));
    assert.equal(transport.committedValues.length, 1, "server commits exactly one job");
    assert.equal(transport.physicalAttempts.length, 1, "unsafe POST must have one physical attempt");
    assert.equal(trace.traces.length, 1, "POST needs one trace record per physical attempt");
    assert.deepEqual(trace.traces[0], {
      operation: "jobs.create",
      method: "POST",
      attempt: 1,
      outcome: "failure",
    });
  });

  const traceShape = await runCheck("attempt_trace_per_physical_request", "trace records physical attempt outcomes", async () => {
    const transport = new EvaluatorScriptedTransport("catalog.read", [
      { kind: "status", status: 503 },
      { kind: "value", value: { sku: "book" } },
    ], errors);
    const clock = new EvaluatorFakeClock();
    const trace = new InMemoryTraceSink();
    const request: RequestSpec<{ sku: string }> = {
      operation: "catalog.read",
      method: "GET",
      retrySafety: "safe",
      send: () => transport.send(),
    };

    await implementation(request, clock, trace);
    assert.equal(trace.traces.length, transport.physicalAttempts.length);
    assert.deepEqual(trace.traces.map((entry) => entry.outcome), ["failure", "success"]);
  });

  const safe500 = await runCheck("safe_http_500_no_retry", "safe HTTP 500 is surfaced without retry", async () => {
    const transport = new EvaluatorScriptedTransport("catalog.read", [
      { kind: "status", status: 500 },
      { kind: "value", value: { sku: "must-not-be-read" } },
    ], errors);
    const clock = new EvaluatorFakeClock();
    const trace = new InMemoryTraceSink();
    const request: RequestSpec<{ sku: string }> = {
      operation: "catalog.read",
      method: "GET",
      retrySafety: "safe",
      send: () => transport.send(),
    };

    let rejected = false;
    try {
      await implementation(request, clock, trace);
    } catch {
      rejected = true;
    }
    assert.equal(rejected, true, "safe HTTP 500 must surface after one physical attempt");
    assert.equal(transport.physicalAttempts.length, 1, "HTTP 500 must not create a second request");
    assert.deepEqual(clock.sleeps, [], "HTTP 500 must not back off");
    assert.deepEqual(trace.traces, [{
      operation: "catalog.read",
      method: "GET",
      attempt: 1,
      outcome: "failure",
    }]);
  });

  return [safeGet, unsafePost, traceShape, safe500];
}

const options = parseOptions(process.argv.slice(2));
const loaded = await loadImplementation(options);
const checks = await evaluate(loaded.implementation, loaded.errors);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"} ${check.name}${check.pass ? "" : `: ${check.detail}`}`);
}
const passed = checks.every((check) => check.pass);
const report: EvaluationReport = {
  schema_version: "workshop-eval/v1",
  evaluator_version: EVALUATOR_VERSION,
  task: options.task ?? null,
  run_dir: options.runDir ?? null,
  target: loaded.target,
  completion_status: passed ? "COMPLETE" : "FAILED",
  hard_gates: checks.map((check) => ({
    id: check.id,
    status: check.pass ? "PASS" : "FAIL",
    detail: check.detail,
  })),
  checks: checks.map((check) => ({
    id: check.id,
    name: check.name,
    status: check.pass ? "PASS" : "FAIL",
    detail: check.detail,
  })),
};
if (options.reportPath !== undefined) {
  await mkdir(dirname(options.reportPath), { recursive: true });
  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`REPORT ${options.reportPath}`);
}
console.log(`RESULT ${passed ? "PASS" : "FAIL"} target=${loaded.target}`);
if (!passed) {
  process.exitCode = 1;
}
