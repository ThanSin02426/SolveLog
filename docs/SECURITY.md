# Security design

## One-repository access

SolveLog's recommended setup uses a GitHub fine-grained personal access token restricted to one dedicated repository with:

- Repository permissions → **Contents: Read and write**
- Metadata → GitHub's implicit read-only access

The safe modes are:

1. **Download mode:** no GitHub permission; the user commits the exported ZIP manually.
2. **Fine-grained token:** automatic commits restricted to one repository.
3. **GitHub App:** a possible future onboarding option using selected-repository installation and short-lived tokens.

## Contest Safe Mode

Contest Safe Mode is enabled by default and is part of the free edition.

- Contest submissions are placed in local extension storage.
- They do not enter the GitHub queue automatically.
- The popup clearly reports Contest Safe Mode and the number of waiting items.
- The settings page lets the user review metadata, open the original problem, release selected items, release all items, or discard selected items.
- Released items enter the same sequential FIFO queue as normal submissions.
- No contest code is included in the public settings response shown to popup or settings UI; the UI receives metadata summaries only.

Contest route detection is a safety aid, not a guarantee against every future website change. Users should verify the Vault before publishing after a contest.

## Token handling

- Stored only in `chrome.storage.local`.
- Not placed in `chrome.storage.sync`.
- Never included in console output, analytics, crash reports, GitHub files, or Contest Vault summaries.
- Sent only in the `Authorization` header to `https://api.github.com`.
- Removed immediately when the user selects **Forget token**.

Browser extension local storage is not a hardware vault. A compromised browser profile or malicious software running as the user may still read it. Users should set an expiry date and revoke the token if the computer is lost.

## Persistent queue and local storage

The queue and Contest Vault are intentionally local so they survive popup closure and browser restarts. Source code is removed from the queue after a successful save. Contest source code remains until release or discard.

SolveLog limits both queue and Vault size to reduce accidental unbounded local storage growth.

## Chrome permissions

- `storage`: settings, queue, Contest Vault, recently handled IDs, token
- `downloads`: zero-access ZIP export
- `notifications`: save, Vault, and failure notifications
- `alarms`: resume queued writes and retry temporary failures
- `activeTab`: manually read the active LeetCode editor when the user presses Save
- Host `leetcode.com`: detect accepted submissions, contest routes, and public problem metadata
- Host `api.github.com`: write only to the configured repository using the user's restricted token

No browsing history, cookies, clipboard, identity, microphone, camera, or all-sites permission is requested.

## Future paid products

Future commercial editions must keep payment secrets, licence secrets, webhook secrets, and backend credentials outside the extension package. The free repository must never contain those secrets.

## Reporting

Publish a security contact email before a store launch. Handle reports privately and do not ask reporters to post leaked tokens in public issues.
