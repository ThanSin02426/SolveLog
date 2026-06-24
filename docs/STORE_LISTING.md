# Chrome Web Store listing draft

## Name

SolveLog — LeetCode Solution Archive

## Short description

Save accepted LeetCode solutions to one GitHub repo, organised by topic and difficulty, with a zero-access download mode.

## Detailed description

SolveLog turns accepted LeetCode submissions into a clean revision repository.

Each solution is organised as topic → difficulty → problem, with source code, metadata, runtime and memory results, and a README that preserves your personal notes.

Key features:

- Automatic save after an Accepted result
- Topic-first organisation for arrays, dynamic programming, graphs, trees, sorting and more
- Easy, Medium and Hard folders inside every topic
- Fine-grained GitHub token limited to one selected repository
- Download-only mode with no GitHub permission
- A persistent one-at-a-time save queue for rapid submissions
- Atomic commits and automatic retry after temporary failures
- Multiple programming languages per problem
- No copied problem statements
- No analytics, advertising or remote executable code

GitHub mode requires a fine-grained token with Contents read/write permission for the selected repository. SolveLog does not request access to every repository.

SolveLog is independent and is not affiliated with or endorsed by LeetCode or GitHub.

## Single purpose

Save the user's accepted coding-problem submissions to a user-selected GitHub repository or local download, and organise them for revision.

## Permission justifications

- Storage: saves settings, the repository-scoped token, the persistent FIFO queue and recently handled submission IDs.
- Downloads: exports a ZIP when the user chooses zero-access download mode.
- Notifications: confirms successful saves and reports failures.
- Alarms: resumes queued writes and retries temporary failures.
- Active tab: lets the user manually save the solution from the currently open LeetCode tab.
- leetcode.com host access: observes the user's own submission result and reads public problem metadata on problem pages.
- api.github.com host access: commits generated files to the repository explicitly configured by the user.

## Screenshot plan

1. Extension popup after a successful commit.
2. Security setup showing “Only select repositories”.
3. Generated GitHub structure grouped by topic and difficulty.
4. Problem README with preserved notes.
5. Download-only mode.

Do not put competitor names, star ratings, “best”, “#1”, or unsupported security claims in the listing.
