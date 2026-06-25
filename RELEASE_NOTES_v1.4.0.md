# SolveLog 1.4.0 — Contest Safe Mode

SolveLog 1.4.0 keeps contest solutions private until you decide they are ready to publish.

## What is new

- **Contest Safe Mode**, enabled by default
- A persistent, local **Contest Vault**
- Review and select contest solutions after the contest
- Release selected solutions or the entire Vault
- Discard local copies that should not be published
- Released solutions enter the existing one-at-a-time GitHub queue
- LeetCode contest-route support
- Platform-independent submission schema for future adapters
- Platform-aware duplicate protection
- Updated privacy and security documentation
- New automated tests for the Vault, release flow, submission model, queue, and UI contract

## Privacy behaviour

Accepted contest solutions remain in local browser extension storage. They are not sent to GitHub until the user explicitly releases them from SolveLog settings.

SolveLog 1.4.0 includes no analytics, advertising, remote executable code, or SolveLog-operated server.

## Install from GitHub

1. Download and extract `solvelog-v1.4.0.zip` or the source archive.
2. Open `chrome://extensions`, `brave://extensions`, or `edge://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the extracted extension folder.

When updating an existing unpacked installation, replace the files inside the same loaded folder and click **Reload** so your local settings remain associated with the same extension installation.
