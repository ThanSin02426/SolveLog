# Publishing checklist

## Test locally

1. Run `npm run validate`.
2. Load the extension unpacked in Chrome and Brave.
3. Test accepted submissions in at least C++, Java, Python and JavaScript.
4. Test a repository with a README and a completely empty repository.
5. Test private and public repositories.
6. Revoke the token and confirm the error is understandable.
7. Turn on download mode and verify the ZIP opens correctly.
8. Edit notes under a generated problem README, resubmit, and confirm notes remain.
9. Submit two or more accepted solutions within a few seconds and confirm they save in FIFO order.
10. Close the popup during a save, reopen it, and confirm the queue state is preserved.
11. Reload the extension with queued work and confirm the queue resumes.
12. Test duplicate submissions and an external commit made while SolveLog is saving.

## Package

Run:

```bash
npm run package
```

Upload `dist/solvelog-v1.4.0.zip` to the Chrome Web Store Developer Dashboard.

## Developer account

- Register a Chrome Web Store developer account and pay the one-time registration fee shown by Google.
- Enable two-step verification on the publishing Google account.
- Complete publisher details and declare Trader or Non-Trader status where required.

## Store dashboard

Complete:

- Store listing
- Privacy practices
- Single-purpose statement
- Permission justifications
- Privacy policy URL
- Distribution countries
- Test instructions for reviewers
- Screenshots and promotional images

## Reviewer instructions

Create a dedicated test repository and a short-lived fine-grained token limited to that repository. Include exact steps to trigger a manual sync so the reviewer does not need to solve a problem.

## Policy choices already made

- Manifest V3
- No remotely hosted JavaScript
- No `eval`
- No all-sites permission
- No cookies permission
- No browsing-history permission
- No copied problem statements
- No analytics in v1
- Clear GitHub permission disclosure

## Before public release

Replace the privacy-policy contact placeholder with a real monitored email. Host the policy on a stable HTTPS page, such as GitHub Pages or your product website.
