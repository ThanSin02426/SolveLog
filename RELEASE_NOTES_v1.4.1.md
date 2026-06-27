# SolveLog 1.4.1 — Queue Stability Hotfix

SolveLog 1.4.1 is a stability update for the free edition. It keeps all Contest Safe Mode features from 1.4.0 and fixes a queue bug that could appear after submitting multiple accepted solutions for the same problem.

## Fixed

- Repeated accepted submissions for the same problem and language no longer create competing queue entries.
- The latest pending attempt replaces the older pending attempt before GitHub sync starts.
- Legacy queue entries such as `manual:problem:unknown` are rebuilt during migration.
- Duplicate queue entries are deduplicated by platform submission id and by problem/language track.
- Already-saved identical solution files are treated as duplicates instead of errors.
- A permanently failed item no longer blocks valid queued submissions behind it.
- Added tests for same-problem resubmission, legacy queue repair, and failed-item bypass.

## Included from 1.4.0

- Contest Safe Mode.
- Local Contest Vault.
- Review, release, and discard contest submissions.
- Platform-independent submission schema.
- Persistent FIFO queue and one GitHub write at a time.

## Install

1. Download and extract `solvelog-v1.4.1.zip`.
2. Open `chrome://extensions`, `brave://extensions`, or `edge://extensions`.
3. Enable Developer mode.
4. Click **Load unpacked**.
5. Select the extracted SolveLog folder.

If you are already using SolveLog from source, replace your existing files with this release and click **Reload** on the extension page.
