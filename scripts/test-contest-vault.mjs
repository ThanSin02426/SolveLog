import assert from "node:assert/strict";
import {
  normaliseContestVault,
  publicVaultItems,
  releaseVaultSubmission,
  selectVaultItems,
  vaultSubmission,
  vaultSummary
} from "../src/background/contest-vault.js";

function submission(id, title) {
  return {
    platform: "leetcode",
    platformSubmissionId: id,
    problem: { id, title, slug: title.toLowerCase().replaceAll(" ", "-"), difficulty: "Medium", url: `https://leetcode.com/problems/${id}/` },
    solution: { language: "cpp", code: `return ${id};` },
    context: { kind: "contest", contestId: "weekly-test", contestTitle: "Weekly Test" },
    solvedAt: "2026-06-25T00:00:00.000Z"
  };
}

let result = vaultSubmission([], submission("1", "First"));
assert.equal(result.added, true);
assert.equal(result.vault.length, 1);
result = vaultSubmission(result.vault, submission("2", "Second"));
assert.equal(result.vault.length, 2);
const duplicate = vaultSubmission(result.vault, { ...submission("1", "First"), runtime: "1 ms" });
assert.equal(duplicate.added, false);
assert.equal(duplicate.vault.length, 2);

const summary = vaultSummary(result.vault);
assert.equal(summary.count, 2);
assert.equal(summary.contests, 1);
const publicItems = publicVaultItems(result.vault);
assert.equal(publicItems.length, 2);
assert.equal("code" in publicItems[0], false);

const selected = selectVaultItems(result.vault, [publicItems[0].id]);
assert.equal(selected.selected.length, 1);
assert.equal(selected.remaining.length, 1);
const released = releaseVaultSubmission(selected.selected[0].submission);
assert.equal(released.syncSource, "contest-release");
assert.equal(released.context.releasedFromVault, true);
assert.equal(normaliseContestVault([{ submission: {} }]).length, 0);

console.log("Contest Vault tests passed.");
