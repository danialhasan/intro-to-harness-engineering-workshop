"""One fixed Prime Verifiers v1 task and deterministic scorer."""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path

import verifiers.v1 as vf

TASK_ID = "retry-http/v1"
PACKAGE_DIR = Path(__file__).resolve().parent
FIXTURE_DIR = PACKAGE_DIR.parents[3] / "candidates" / "retry-http"
SKIP_PARTS = {".git", "node_modules", "dist", "runs"}
GATE_IDS = (
    "safe_get_retry",
    "unsafe_post_no_duplicate",
    "attempt_trace_per_physical_request",
    "safe_http_500_no_retry",
)


class RetryHttpData(vf.TaskData):
    task_id: str
    fixture_version: str


class RetryHttpTask(vf.Task[RetryHttpData]):
    async def setup(self, trace: vf.Trace, runtime: vf.Runtime) -> None:
        """Copy only the public synthetic fixture into a fresh Prime runtime."""
        if runtime.info.type == "subprocess" and hasattr(runtime, "workdir"):
            original = getattr(runtime, "workdir")
            isolated = Path(tempfile.gettempdir()) / "prime-harness-workshop" / trace.id
            isolated.mkdir(parents=True, exist_ok=False)
            setattr(runtime, "workdir", isolated)
            runtime.info.id = str(isolated)
            if isinstance(original, Path):
                shutil.rmtree(original, ignore_errors=True)
        if not FIXTURE_DIR.is_dir():
            raise FileNotFoundError(f"public fixture is missing: {FIXTURE_DIR}")
        for source in sorted(FIXTURE_DIR.rglob("*")):
            relative = source.relative_to(FIXTURE_DIR)
            if not source.is_file() or any(part in SKIP_PARTS for part in relative.parts):
                continue
            await runtime.write(relative.as_posix(), source.read_bytes())
        install = await runtime.run(
            ["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"], {}
        )
        if install.exit_code != 0:
            raise RuntimeError(f"fixture npm install failed: {install.stderr[-1000:]}")
        trace.info["fixture_install"] = "npm ci --ignore-scripts --no-audit --no-fund"

    async def finalize(self, trace: vf.Trace, runtime: vf.Runtime) -> None:
        """Run the fixed evaluator after the agent stops and retain its report."""
        result = await runtime.run(
            [
                "sh",
                "-c",
                "npm run eval -- --task retry-http/v1 --run-dir . "
                "--report \"$PWD/evaluation-report.json\"",
            ],
            {},
        )
        report = json.loads((await runtime.read("evaluation-report.json", 256_000)).decode())
        trace.info["evaluation"] = report
        trace.info["evaluation_exit_code"] = result.exit_code
        if result.exit_code not in (0, 1):
            raise RuntimeError(f"fixed evaluator failed to run: {result.stderr[-1000:]}")

    def _gate(self, gate_id: str, trace: vf.Trace) -> float:
        report = trace.info.get("evaluation", {})
        gates = report.get("hard_gates", []) if isinstance(report, dict) else []
        return float(
            any(
                isinstance(gate, dict)
                and gate.get("id") == gate_id
                and gate.get("status") == "PASS"
                for gate in gates
            )
        )

    @vf.reward(weight=0.25)
    async def safe_get_retry(self, trace: vf.Trace) -> float:
        return self._gate("safe_get_retry", trace)

    @vf.reward(weight=0.25)
    async def unsafe_post_no_duplicate(self, trace: vf.Trace) -> float:
        return self._gate("unsafe_post_no_duplicate", trace)

    @vf.reward(weight=0.25)
    async def attempt_trace_per_physical_request(self, trace: vf.Trace) -> float:
        return self._gate("attempt_trace_per_physical_request", trace)

    @vf.reward(weight=0.25)
    async def safe_http_500_no_retry(self, trace: vf.Trace) -> float:
        return self._gate("safe_http_500_no_retry", trace)

    @vf.metric
    async def evaluator_gates_passed(self, trace: vf.Trace) -> float:
        return sum(self._gate(gate_id, trace) for gate_id in GATE_IDS)

    @vf.metric
    async def evaluator_complete(self, trace: vf.Trace) -> float:
        report = trace.info.get("evaluation", {})
        return float(
            isinstance(report, dict) and report.get("completion_status") == "COMPLETE"
        )

    @property
    def key(self) -> str:
        return TASK_ID


class RetryHttpTaskset(vf.Taskset[RetryHttpTask]):
    def load(self) -> list[RetryHttpTask]:
        task_text = (FIXTURE_DIR / "TASK.md").read_text()
        return [
            RetryHttpTask(
                RetryHttpData(
                    idx=0,
                    name=TASK_ID,
                    description="Implement retry-safe HTTP behavior in the included fixture.",
                    prompt=task_text,
                    task_id=TASK_ID,
                    fixture_version="retry-http-fixture/1",
                ),
                self.config.task,
            )
        ]
