# Publishing SolveLog 1.4.1 on GitHub

This guide is for the project maintainer. It is intentionally separate from the public README.

## 1. Replace the old working tree

Copy the contents of the SolveLog 1.4.1 source folder into your existing local SolveLog Git repository. Keep the existing `.git` directory.

Before doing anything else:

```bash
pwd
git rev-parse --show-toplevel
git status
```

The repository root must be the SolveLog project folder—not your macOS home folder.

## 2. Check for secrets

```bash
grep -RniE "github[_]pat_|gh[p]_|gh[o]_|gh[u]_|gh[s]_|rzp[_]live_|rzp[_]test_" . \
  --exclude-dir=.git \
  --exclude="*.zip"
```

No personal token or payment secret should appear.

## 3. Validate and package

```bash
npm run validate
npm run package
```

Expected package:

```text
dist/solvelog-v1.4.1.zip
```

## 4. Commit and tag

```bash
git add .
git status
git commit -m "Release SolveLog 1.4.1 with Contest Safe Mode"
git tag -a v1.4.1 -m "SolveLog 1.4.1"
git push origin main
git push origin v1.4.1
```

## 5. Create the GitHub Release

On GitHub:

1. Open the SolveLog repository.
2. Select **Releases** → **Draft a new release**.
3. Choose tag `v1.4.1`.
4. Title it `SolveLog 1.4.1 — Contest Safe Mode`.
5. Attach `dist/solvelog-v1.4.1.zip`.
6. Paste the release notes below.
7. Publish the release.

## Suggested release notes

```text
SolveLog 1.4.1 adds Contest Safe Mode and a local Contest Vault.

Accepted solutions detected on LeetCode contest routes now stay in the browser until you review and release them. The release also introduces a platform-independent submission model, safer duplicate identifiers, updated privacy documentation, and new automated tests.

Highlights
- Contest Safe Mode enabled by default
- Local Contest Vault that survives browser restarts
- Review, release selected, release all, and discard controls
- Released solutions use the existing one-at-a-time GitHub queue
- No analytics, remote code, or SolveLog-operated server

Installation
Download the source or release ZIP, extract it, open your browser's extensions page, enable Developer mode, and choose Load unpacked.
```

## 6. Test the GitHub release ZIP

Extract the uploaded ZIP into a fresh folder and load it as an unpacked extension. Test:

1. a normal accepted LeetCode submission;
2. two rapid normal submissions;
3. an accepted solution on a contest route;
4. browser restart while a Vault item exists;
5. release of a Vault item into GitHub;
6. discard of a Vault item;
7. Download mode;
8. dark mode and all colour packs.

Do not reuse a browser profile containing older SolveLog copies or another LeetCode-to-GitHub extension during the release test.
