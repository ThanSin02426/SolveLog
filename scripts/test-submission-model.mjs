import assert from "node:assert/strict";
import {
  createSubmission,
  isContestSubmission,
  normaliseSubmission,
  publicSubmissionSummary,
  submissionSeenKey,
  wasSubmissionSeen
} from "../src/shared/submission-model.js";

const legacy = normaliseSubmission({
  frontendId: "1",
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "Easy",
  tags: ["Array", "Hash Table"],
  language: "cpp",
  code: "return {};",
  submissionId: "123",
  url: "https://leetcode.com/problems/two-sum/"
});

assert.equal(legacy.schemaVersion, 2);
assert.equal(legacy.platform, "leetcode");
assert.equal(legacy.problem.id, "1");
assert.equal(legacy.solution.language, "cpp");
assert.equal("code" in legacy, false, "canonical submissions must not duplicate source code at the top level");
assert.equal(submissionSeenKey(legacy), "leetcode:123");
assert.equal(wasSubmissionSeen(["123"], legacy), true, "legacy seen IDs should migrate safely");
assert.equal(wasSubmissionSeen(["leetcode:123"], legacy), true);

const contest = createSubmission({
  platform: "leetcode",
  platformSubmissionId: "456",
  problem: { id: "2", title: "Contest Task", slug: "contest-task", difficulty: "Medium", url: "https://leetcode.com/problems/contest-task/" },
  solution: { language: "python3", code: "pass" },
  context: { kind: "contest", contestId: "weekly-1", contestTitle: "Weekly 1" }
});
assert.equal(isContestSubmission(contest), true);
assert.equal(contest.context.kind, "contest");
const summary = publicSubmissionSummary(contest);
assert.equal(summary.title, "Contest Task");
assert.equal("code" in summary, false);

console.log("Submission model tests passed.");
