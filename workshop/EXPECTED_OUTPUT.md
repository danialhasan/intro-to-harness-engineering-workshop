# Sanitized H0-H4 example

This is a fallback example, not a fresh participant experiment. Actual results
can progress, regress, or remain unchanged.

```text
| Variant | Contract first | Test before edit | Verify after edit | Status | Actions | Turns |
| H0      | no             | no               | YES               | COMPLETE | 21    | 11    |
| H1      | YES            | no               | YES               | COMPLETE | 19    | 10    |
| H2      | YES            | YES              | YES               | COMPLETE | 23    | 12    |
| H3      | YES            | YES              | YES               | COMPLETE | 20    | 10    |
| H4      | YES            | YES              | YES               | COMPLETE | 18    | 9     |
```

The numbers are illustrative. A declared instruction can fail to appear in the
trace, and a stronger policy can use more actions or receive a lower score.

Every adjacent check must report:

```text
VALID; 24 fixed controls MATCH; policy DIFFERENT
```

Each live summary includes only task ID, evaluation state, stop condition,
rewards, metrics, and sanitized ordered tool actions. It excludes raw content,
tool results, command output, credentials, and absolute paths.

Example limited interpretation:

```text
In this ladder, all adjacent controls matched and the policies produced the
reported action sequences and scores. One run per policy does not establish
causality or general benefit.
```
