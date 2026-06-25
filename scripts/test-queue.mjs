import assert from "node:assert/strict";
import {
  enqueueSubmission,
  isQueueItemEligible,
  markQueueForRetry,
  normaliseQueue,
  submissionQueueId
} from "../src/background/queue-utils.js";

const first = { submissionId: "100", slug: "two-sum", title: "Two Sum", language: "cpp", code: "a" };
const second = { submissionId: "101", slug: "three-sum", title: "3Sum", language: "cpp", code: "b" };

let result = enqueueSubmission([], first, "2026-06-25T00:00:00.000Z");
assert.equal(result.added, true);
assert.equal(result.position, 1);
assert.equal(result.queue[0].id, "leetcode:submission:100");

result = enqueueSubmission(result.queue, second, "2026-06-25T00:00:01.000Z");
assert.equal(result.position, 2);
assert.deepEqual(result.queue.map((item) => item.submission.platformSubmissionId), ["100", "101"]);

const duplicate = enqueueSubmission(result.queue, { ...first, runtime: "1 ms" });
assert.equal(duplicate.added, false);
assert.equal(duplicate.queue.length, 2);
assert.equal(duplicate.queue[0].submission.solution.runtime, "1 ms");

const manualA = { submissionId: "manual", slug: "two-sum", language: "cpp", code: "return 1;" };
const manualB = { ...manualA };
assert.equal(submissionQueueId(manualA), submissionQueueId(manualB));

const legacy = normaliseQueue([first, first, second]);
assert.equal(legacy.length, 2);
assert.equal(legacy[0].submission.platformSubmissionId, "100");
assert.equal(legacy[1].submission.platformSubmissionId, "101");

const delayed = { ...legacy[0], nextAttemptAt: new Date(Date.now() + 60_000).toISOString() };
assert.equal(isQueueItemEligible(delayed), false);
assert.equal(isQueueItemEligible(delayed, Date.now(), true), true);

const failed = [{ ...legacy[0], state: "failed", lastError: "x", nextAttemptAt: null }];
const retried = markQueueForRetry(failed);
assert.equal(retried[0].state, "queued");
assert.equal(retried[0].lastError, "");

console.log("Queue tests passed.");
