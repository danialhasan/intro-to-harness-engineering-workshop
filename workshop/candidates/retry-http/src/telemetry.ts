import type { HttpMethod } from "./http/types.js";

export interface AttemptTrace {
  operation: string;
  method: HttpMethod;
  attempt: number;
  outcome: "success" | "failure";
}

export interface TraceSink {
  record(trace: AttemptTrace): void;
}

export class InMemoryTraceSink implements TraceSink {
  readonly traces: AttemptTrace[] = [];

  record(trace: AttemptTrace): void {
    this.traces.push(trace);
  }
}
