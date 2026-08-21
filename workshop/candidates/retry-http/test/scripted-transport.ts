import {
  HttpStatusError,
  ResponseLostAfterCommitError,
  type Clock,
} from "../src/http/types.js";

export type ScriptedResult<T> =
  | { kind: "value"; value: T }
  | { kind: "status"; status: number }
  | { kind: "commit-then-lose"; value: T };

export class FakeClock implements Clock {
  readonly sleeps: number[] = [];

  async sleep(milliseconds: number): Promise<void> {
    this.sleeps.push(milliseconds);
  }
}

export class ScriptedTransport<T> {
  readonly physicalAttempts: string[] = [];
  readonly committedValues: T[] = [];
  private cursor = 0;

  constructor(
    readonly operation: string,
    private readonly script: readonly ScriptedResult<T>[],
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
      throw new HttpStatusError(result.status);
    }
    this.committedValues.push(result.value);
    throw new ResponseLostAfterCommitError();
  }
}
