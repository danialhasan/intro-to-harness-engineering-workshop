# Prime Verifiers v1 workshop runner

Start with [the participant workshop guide](../README.md).

This folder contains:

- `prime/`: the pinned Prime v1 project and `retry-http-v1` Taskset package;
- `configs/`: fixed baseline and changed Prime configs;
- `policies/`: the baseline policy and bounded participant policy;
- `src/oauth-proxy.ts`: the localhost Pi OAuth subscription adapter;
- `src/prime-run.ts`: the baseline and changed run wrapper;
- `src/prime-compare.ts`: the fixed-control comparator;
- `runs/`: local private Prime traces, ignored by Git.

Prime upload is disabled. Do not commit or publish `runs/`.
