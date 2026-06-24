<div align="center">
  <img src="assets/icons/icon-128.png" width="96" alt="SolveLog logo">

# SolveLog

### Your accepted LeetCode solutions, filed where you can actually find them.

SolveLog is a free, open-source browser extension that saves every **Accepted** LeetCode submission to a GitHub repository you choose—organised by **topic → difficulty → problem**.

[![Version](https://img.shields.io/badge/version-1.3.0-ff3b8d?style=flat-square)](#)
[![Manifest](https://img.shields.io/badge/Chrome-Manifest%20V3-3478f6?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-00c96b?style=flat-square)](LICENSE)
[![Privacy](https://img.shields.io/badge/analytics-none-ffd400?style=flat-square)](docs/SECURITY.md)

</div>

---

## Why I built this

Solving a problem feels useful in the moment, but a few weeks later the code is buried inside submission history. I wanted something simple: solve the problem once, and let the archive take care of itself.

SolveLog watches for an **Accepted** result, saves the exact submitted code, and files it into a clean GitHub study repository. No copying, no renaming folders, and no broad access to every repository in your account.

<img src="assets/screenshots/welcome-and-purpose.png" alt="SolveLog welcome screen explaining the purpose of the extension" width="100%">

## What it does

- Saves only **Accepted** submissions.
- Organises solutions as `Topic / Difficulty / Problem`.
- Stores code, metadata, runtime, memory, tags, and a problem link.
- Supports multiple programming languages.
- Uses a persistent FIFO queue, so rapid submissions are committed **one at a time**.
- Prevents duplicate commits for the same submission.
- Includes a manual **Save this solution** fallback.
- Supports light, dark, and system themes with five colour packs.
- Loads no remote JavaScript and includes no analytics or advertising.

## A small interface with a clear job

The popup shows your archive total, difficulty breakdown, sync status, and queue state without turning the extension into another dashboard you have to manage.

<div align="center">
  <img src="assets/screenshots/popup-dashboard.png" alt="SolveLog popup showing archive statistics and controls" width="390">
</div>

## Safer GitHub access

SolveLog does **not** need permission to every repository in your account.

The recommended setup uses a GitHub **fine-grained personal access token** restricted to:

- **Only one selected repository**
- Repository permission: **Contents — Read and write**
- No classic `repo` scope
- No organisation-wide access

The token is stored locally in `chrome.storage.local`, is never synced through your browser account, is never logged, and is sent only to GitHub's API.

<img src="assets/screenshots/secure-repository-setup.png" alt="SolveLog settings showing the one-repository GitHub setup" width="100%">

Prefer zero GitHub access? Use **Download mode** and commit the generated files yourself.

## Repository structure

A solved problem is stored once under its primary topic:

```text
leetcode-solutions/
├── README.md
├── .solvelog/
│   └── index.json
├── Arrays/
│   ├── Easy/
│   ├── Medium/
│   └── Hard/
├── Binary-Search/
│   └── Medium/
│       └── 0033-search-in-rotated-sorted-array/
│           ├── README.md
│           ├── metadata.json
│           └── solution.cpp
└── Dynamic-Programming/
    └── Easy/
        └── 0070-climbing-stairs/
            ├── README.md
            ├── metadata.json
            └── solution.cpp
```

Problems with several LeetCode tags are not copied into several folders. SolveLog chooses one primary topic and keeps the remaining tags in `metadata.json`.

## How saving works

```text
Accepted on LeetCode
        ↓
Stored safely in the local queue
        ↓
Problem metadata is collected
        ↓
Latest GitHub branch is fetched
        ↓
README + metadata + code are committed together
        ↓
The next queued solution begins
```

Each submission is written as one atomic commit. The queue survives popup closure, tab changes, browser restarts, and temporary GitHub errors.

## Contributing

Bug reports and small, focused pull requests are welcome. A helpful issue includes:

- Browser and version
- LeetCode problem URL
- What you expected
- What happened instead
- The error shown on `chrome://extensions` or `brave://extensions`

## License

SolveLog is available under the [MIT License](LICENSE).

“LeetCode” and “GitHub” are trademarks of their respective owners. SolveLog is an independent project and is not affiliated with or endorsed by either company.

---

<div align="center">
  <strong>Accepted → sorted → saved.</strong><br>
  Built for people who want their practice to become something they can revisit.
</div>
