# Security design

## Current release: one-repository token

SolveLog's recommended self-hosted setup uses a GitHub fine-grained personal access token. The user must restrict it to one dedicated repository and grant only:

- Repository permissions → **Contents: Read and write**
- Metadata remains the implicit read-only permission GitHub requires

The extension cannot commit to GitHub with literally no permission. The safe options are:

1. **Download mode:** no GitHub permission; the user commits the exported ZIP manually.
2. **Fine-grained token:** direct automatic commits, restricted to one repository.
3. **GitHub App:** best public-product onboarding; users install it on only selected repositories.

## Why the extension does not use a normal OAuth App

A traditional GitHub OAuth token commonly relies on broad scopes. That is the exact trust problem this project is avoiding. A GitHub App uses narrow permissions and repository selection.

## Token handling

- Stored only in `chrome.storage.local`.
- Not placed in `chrome.storage.sync`.
- Never included in console output, analytics, crash reports, or GitHub files.
- Sent only in the `Authorization` header to `https://api.github.com`.
- Removed immediately when the user selects **Forget token**.

Browser extension local storage is not a hardware vault. A compromised browser profile or malicious software running as the user may still read it. Users should set an expiry date and revoke the token if the computer is lost.

## GitHub App migration

Before marketing SolveLog broadly, migrate onboarding to a GitHub App:

- Repository permission: Contents, read and write
- Account permissions: none
- Installation target: **Only select repositories**
- Backend responsibilities: OAuth callback, client-secret protection, short-lived installation-token generation
- Extension responsibility: hold only a short-lived session credential

Never embed a GitHub App private key, client secret, Stripe secret, or signing secret in the extension package.

## Chrome permissions

- `storage`: settings, persistent FIFO queue, recently handled IDs, token
- `downloads`: zero-access ZIP export
- `notifications`: sync success and failure
- `alarms`: resume queued writes and retry temporary failures
- `activeTab`: manually read the current LeetCode problem when the user presses Save
- Host `leetcode.com`: detect the user's accepted submission and read public metadata
- Host `api.github.com`: write only to the configured repository using the user's restricted token

No browsing history, tabs, cookies, clipboard, identity, or all-sites permission is requested.

## Reporting

Publish a security contact email before store launch. Handle reports privately and avoid asking reporters to post token leaks in public issues.
