# SolveLog 1.4.2 — Submission Verdict Hotfix

This hotfix prevents SolveLog from saving a solution when a LeetCode submission page shows **Wrong Answer** but the lower editor **Test Result** panel still contains **Accepted** for sample tests.

## Fixed

- The fallback detector now trusts only the real submitted verdict attached to the full testcase count, for example `Accepted 48 / 48 testcases passed`.
- Wrong Answer, Runtime Error, TLE, MLE, Compile Error, and Compilation Error submission pages no longer trigger auto-save because of sample-run text.
- Added regression coverage for the exact case where `Wrong Answer 71 / 191 testcases passed` appears on the same page as `Test Result Accepted`.

## Why this matters

LeetCode pages can show two different result areas at the same time:

1. the actual submitted verdict, and
2. the editor's local Test Result panel.

SolveLog should only save after the actual submitted verdict is Accepted.

## Install

Download `solvelog-v1.4.2.zip`, extract it, then load the extracted folder from `chrome://extensions`, `brave://extensions`, or `edge://extensions` using **Load unpacked**.
