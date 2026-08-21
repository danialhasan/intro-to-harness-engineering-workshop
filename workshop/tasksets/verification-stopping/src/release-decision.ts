export type CheckResult = { name: string; status: "pass" | "fail" };

export type ReleaseDecision =
  | { status: "ready"; marker: string }
  | { status: "blocked"; reason: string };

export function decideRelease(checks: CheckResult[], artifactDigest: string, approvedDigest: string): ReleaseDecision {
  return { status: "ready", marker: `release:${artifactDigest}` };
}
