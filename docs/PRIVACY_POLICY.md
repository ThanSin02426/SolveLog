# SolveLog Privacy Policy

**Effective date:** 25 June 2026

SolveLog is a browser extension that saves a user's accepted coding-problem submissions to a location chosen by the user.

## Data the extension processes

SolveLog processes:

- submitted source code;
- problem title, identifier, URL, difficulty, and public topic tags;
- programming language, runtime, and memory result;
- submission identifier and capture time;
- contest identifier and contest route when Contest Safe Mode is active;
- the GitHub repository details configured by the user; and
- the GitHub token entered by the user when GitHub mode is enabled.

## How data is used

The data is used only to:

- generate solution files;
- place normal accepted submissions in the local save queue;
- keep contest submissions in the local Contest Vault until the user releases them;
- commit generated files to the selected GitHub repository; or
- download generated files to the user's computer.

## Contest Vault

When Contest Safe Mode is enabled and SolveLog detects a contest route, the accepted code and related metadata are stored in the browser's local extension storage. Contest Vault items are not sent to GitHub until the user explicitly releases them.

The user can release or permanently discard Contest Vault items from SolveLog settings.

## Data sharing

SolveLog sends data only to services needed for its single purpose:

- LeetCode, to read the current problem's public metadata and observe the user's own submission result;
- GitHub API, only after a normal submission enters the save queue or the user releases a Contest Vault item; and
- the browser download system when Download mode is enabled.

SolveLog does not sell data, use it for advertising, create behavioural profiles, or transfer it to data brokers.

## Analytics

The free edition does not include analytics, tracking pixels, advertising SDKs, or remote executable code.

## Storage and retention

Settings, queued submissions, Contest Vault items, recently processed submission identifiers, and the GitHub token are stored locally in the user's browser profile.

- Successfully saved queue items are removed automatically.
- Contest Vault items remain until the user releases or discards them.
- The GitHub token can be removed with **Forget token**.
- All local SolveLog data can be removed by uninstalling the extension and clearing its extension data.

Generated files remain in the user-selected repository or download location until the user deletes them.

## Security

Users are instructed to create a fine-grained GitHub token limited to one repository with only Contents read/write permission. The token is not stored in the source repository and is not synchronised through the user's browser account.

## Contact

Before a public store release, replace this section with a monitored support and privacy email address.

SolveLog is an independent project and is not affiliated with or endorsed by LeetCode or GitHub.
