export type CheckResult = { name: string; status: "pass" | "fail" };

export type ReleaseDecision =
  | { status: "ready"; marker: string }
  | { status: "blocked"; reason: string };

const REQUIRED = ["build", "test", "security"];

export function decideRelease(checks: CheckResult[], artifactDigest: string, approvedDigest: string): ReleaseDecision {
  for (const required of REQUIRED) {
    const result = checks.find((check) => check.name === required);
    if (!result) return { status: "blocked", reason: `missing check: ${required}` };
    if (result.status !== "pass") return { status: "blocked", reason: `failed check: ${required}` };
  }
  if (artifactDigest !== approvedDigest) return { status: "blocked", reason: "artifact digest mismatch" };
  return { status: "ready", marker: `release:${approvedDigest}` };
}
