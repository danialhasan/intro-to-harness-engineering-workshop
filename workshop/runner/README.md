# Workshop runner

This is the real Pi-based runner used by the participant guide. Start at the parent [hands-on workshop README](../README.md).

The runner creates a fresh candidate worktree, runs the pinned Pi coding-agent runtime, records observable lifecycle and tool evidence, and always invokes the task's deterministic evaluator when possible. It does not implement another model loop and does not save hidden model reasoning.

The only participant-editable area is the instruction-string array marked `PARTICIPANT EDIT START` and `PARTICIPANT EDIT END` in [`src/participant-harness.ts`](src/participant-harness.ts). All commands, fixed controls, privacy rules, and recovery steps are in the parent guide.
