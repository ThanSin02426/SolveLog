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

## Install from source — free

Until the public store listing is available, you can install SolveLog directly from this repository.

### Chrome

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the SolveLog project folder.
6. Open the extension and complete the one-time setup.

### Brave

Use the same steps at `brave://extensions`.

### Microsoft Edge

Use the same steps at `edge://extensions`.

No build step is required for normal use. The extension has no runtime dependencies.

## Connect one GitHub repository

1. Create a dedicated repository for your solutions.
2. Create a GitHub **fine-grained personal access token**.
3. Under **Repository access**, choose **Only select repositories**.
4. Select only your solutions repository.
5. Under **Repository permissions**, set **Contents** to **Read and write**.
6. Leave every other permission unchanged.
7. Enter the owner, repository name, branch, and token in SolveLog settings.
8. Click **Test connection**, then **Save changes**.

Do not use a classic token with the broad `repo` scope.

## Put this project on GitHub

Creating a public GitHub repository for the source code is free. After creating an empty repository, run:

```bash
git init
git add .
git commit -m "Initial public release of SolveLog"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/solvelog.git
git push -u origin main
```

Before pushing, make sure the repository does **not** contain your personal GitHub token, browser storage, or private test data. SolveLog does not keep tokens inside the source folder.

## Development

SolveLog is written in plain JavaScript and uses Chrome Manifest V3.

```bash
npm run validate
```

Validation checks:

- `manifest.json`
- JavaScript syntax
- queue ordering
- duplicate suppression
- retry handling
- legacy queue migration
- service-worker concurrency

Create the Chrome Web Store package with:

```bash
npm run package
```

The ZIP will be written to `dist/`.

## Privacy

SolveLog is intentionally local-first:

- No analytics
- No advertising
- No tracking pixels
- No remote executable code
- No sale of user data
- No copied LeetCode problem statements
- No server operated by SolveLog

Read the full [Security model](docs/SECURITY.md) and [Privacy policy](docs/PRIVACY_POLICY.md).

## Known limitations

LeetCode can change its interface or internal submission endpoints. Automatic detection may occasionally require an update. The manual **Save this solution** button is included so your work is never blocked by a UI change.

Only one LeetCode-to-GitHub extension should be enabled at a time. Running SolveLog alongside LeetHub, LeetPush, or an older SolveLog installation can cause competing GitHub writes.

## Roadmap

- [ ] Chrome Web Store release
- [ ] Microsoft Edge Add-ons release
- [ ] GitHub App sign-in with short-lived tokens
- [ ] Firefox-compatible build
- [ ] Custom topic rules
- [ ] Revision lists and spaced-repetition reminders
- [ ] Import tools for existing solution repositories

## Contributing

Bug reports and small, focused pull requests are welcome. A helpful issue includes:

- Browser and version
- LeetCode problem URL
- What you expected
- What happened instead
- The error shown on `chrome://extensions` or `brave://extensions`

Please remove tokens, email addresses, and private repository details before sharing screenshots or logs.

## License

SolveLog is available under the [MIT License](LICENSE).

“LeetCode” and “GitHub” are trademarks of their respective owners. SolveLog is an independent project and is not affiliated with or endorsed by either company.

---

<div align="center">
  <strong>Accepted → sorted → saved.</strong><br>
  Built for people who want their practice to become something they can revisit.
</div>
