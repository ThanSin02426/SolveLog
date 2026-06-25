# Changelog

## 1.4.0

- Added Contest Safe Mode, enabled by default.
- Added a persistent local Contest Vault for accepted contest submissions.
- Added review, select, release, release-all, and discard controls in settings.
- Ensured contest solutions do not enter the GitHub queue until explicitly released.
- Added contest-route support for LeetCode problem pages.
- Added a contest safety notice on active contest pages.
- Added a platform-independent submission schema while preserving compatibility with older queue data.
- Added platform-aware duplicate identifiers.
- Added Contest Vault, submission-model, and release-flow tests.
- Updated privacy and security documentation for locally stored contest code.

## 1.3.0

- Added a persistent FIFO queue for accepted and manually saved submissions.
- Added a single global GitHub write lock so only one commit can run at a time.
- Added automatic recovery after popup closure, browser restart, or service-worker restart.
- Added retry backoff for temporary network, branch-head, and GitHub service errors.
- Added queue-aware popup states and deterministic duplicate protection.

## 1.2.2

- Correctly detected GitHub's empty-repository response.
- Automatically created the first README and branch before saving solutions.

## 1.2.1

- Switched atomic branch commits to GitHub's `createCommitOnBranch` GraphQL mutation.

## 1.2.0

- Added the pixel-brutalist interface, colour packs, and improved branch-conflict handling.
