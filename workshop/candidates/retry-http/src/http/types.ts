export type HttpMethod = "GET" | "POST";

export type RetrySafety = "safe" | "unsafe";

export interface RequestSpec<T> {
  operation: string;
  method: HttpMethod;
  retrySafety: RetrySafety;
  send(): Promise<T>;
}

export interface Clock {
  sleep(milliseconds: number): Promise<void>;
}

export class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`HTTP ${status}`);
    this.name = "HttpStatusError";
  }
}

export class ResponseLostAfterCommitError extends Error {
  constructor() {
    super("response lost after the server committed the request");
    this.name = "ResponseLostAfterCommitError";
  }
}
