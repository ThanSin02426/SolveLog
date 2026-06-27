import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../src/content/content-script.js", import.meta.url), "utf8");
const match = source.match(/  function submittedVerdictFromText\(text\) \{[\s\S]*?\n  function normaliseVerdict\(value\) \{[\s\S]*?\n  \}/);
assert.ok(match, "fallback verdict detector should exist in content-script.js");

const sandbox = {};
vm.runInNewContext(`${match[0]}\nglobalThis.submittedVerdictFromText = submittedVerdictFromText;`, sandbox);
const verdict = sandbox.submittedVerdictFromText;

const wrongAnswerWithAcceptedSample = `
Wrong Answer 71 / 191 testcases passed
Runtime 0 ms
Memory 12.85 MB
Test Result
Accepted
Case 1
`;
assert.equal(verdict(wrongAnswerWithAcceptedSample), "wrong answer");

const acceptedSubmission = `
Accepted 48 / 48 testcases passed
Runtime 0 ms
Memory 12.85 MB
`;
assert.equal(verdict(acceptedSubmission), "accepted");

const sampleOnly = `
Test Result
Accepted
Case 1
Runtime: 0 ms
`;
assert.equal(verdict(sampleOnly), "");

const countThenAccepted = `
48 / 48 testcases passed
Accepted
Runtime 0 ms
Memory 12 MB
`;
assert.equal(verdict(countThenAccepted), "accepted");

console.log("Fallback detection tests passed.");
