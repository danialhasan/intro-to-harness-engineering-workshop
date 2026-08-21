import type { Clock } from "../src/http/types.js";

export type ScriptedResult<T> =
  | { kind: "value"; value: T }
  | { kind: "status"; status: number }
  | { kind: "commit-then-lose"; value: T };

export interface ErrorFactories {
  createStatusError(status: number): Error;
  createResponseLostError(): Error;
}

/** Fixed evaluator fixture. Participant tests use their own visible copy. */
export class EvaluatorFakeClock implements Clock {
  readonly sleeps: number[] = [];

  async sleep(milliseconds: number): Promise<void> {
    this.sleeps.push(milliseconds);
  }
}

export class EvaluatorScriptedTransport<T> {
  readonly physicalAttempts: string[] = [];
  readonly committedValues: T[] = [];
  private cursor = 0;

  constructor(
    readonly operation: string,
    private readonly script: readonly ScriptedResult<T>[],
    private readonly errors: ErrorFactories,
  ) {}

  async send(): Promise<T> {
    this.physicalAttempts.push(this.operation);
    const result = this.script[this.cursor];
    this.cursor += 1;
    if (result === undefined) {
      throw new Error(`script exhausted for ${this.operation}`);
    }
    if (result.kind === "value") {
      return result.value;
    }
    if (result.kind === "status") {
      throw this.errors.createStatusError(result.status);
    }
    this.committedValues.push(result.value);
    throw this.errors.createResponseLostError();
  }
}
