"""Prime Pi harness placement for the local workshop runtime."""

from verifiers.v1.harnesses.pi import PiHarness
from verifiers.v1.runtimes import Runtime


class RetryHttpHarness(PiHarness):
    """Use Prime's Pi harness in its disposable local subprocess workspace.

    Prime marks third-party harnesses as container-only by default. This workshop
    deliberately uses the local subprocess runtime so Pi can reach the localhost
    OAuth adapter while the task stays inside Prime's disposable runtime folder.
    """

    NEEDS_CONTAINER = False

    async def setup(self, runtime: Runtime) -> None:
        # Prime's script bootstrap prepends $HOME/.local/bin. A disposable HOME
        # prevents an older user-level uv or private Pi resources from leaking in.
        runtime.env["HOME"] = f"{runtime.info.id}/.workshop-home"
        await super().setup(runtime)
