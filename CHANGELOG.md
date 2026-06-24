# Changelog

## 1.3.0

- Added a persistent FIFO queue for accepted and manually saved submissions.
- Added a single global GitHub write lock so only one commit can run at a time.
- Added automatic recovery after popup closure, browser restart, or service-worker restart.
- Added retry backoff for temporary network, branch-head, and GitHub service errors.
- Added queue-aware popup states: queued, saving now, failed, and number waiting.
- Disabled Save, Retry, and auto-save controls while a GitHub write is active.
- Added queue deduplication using submission IDs and deterministic manual-save fingerprints.
- Added migration from the legacy pending-submission list.
- Added deterministic queue tests to the validation command.
- Restyled the in-page notification to match the pixel-brutalist UI without blur or glow.

## 1.2.2

- Correctly detected GitHub's empty-repository response.
- Automatically created the first README and branch before saving solutions.

## 1.2.1

- Switched atomic branch commits to GitHub's `createCommitOnBranch` GraphQL mutation.

## 1.2.0

- Added the pixel-brutalist interface, colour packs, and improved branch-conflict handling.
