# Prime Verifiers v1 workshop runner

Start with [the participant workshop guide](../README.md).

This folder contains:

- `prime/`: the pinned Prime v1 project and `retry-http-v1` Taskset package;
- `configs/`: fixed H0-H4 Prime configs;
- `policies/`: cumulative H0-H3 policies and bounded participant H4;
- `src/oauth-proxy.ts`: the localhost Pi OAuth subscription adapter;
- `src/prime-run.ts`: the fixed five-variant run wrapper;
- `src/prime-inspect.ts`: the sanitized native-trace summary;
- `src/prime-compare.ts`: the adjacent fixed-control comparator;
- `runs/`: local private Prime traces, ignored by Git.

Prime upload is disabled. Do not commit or publish `runs/`.
