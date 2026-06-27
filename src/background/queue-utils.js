import { normaliseSubmission } from "../shared/submission-model.js";

const MAX_QUEUE_SIZE = 100;

export function hashText(value) {
  let hash = 0x811c9dc5;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function submissionQueueId(submission) {
  const item = normaliseSubmission(submission);
  const submissionId = String(item.platformSubmissionId || "").trim();
  if (submissionId && submissionId !== "manual") return `${item.platform}:submission:${submissionId}`;

  const track = submissionTrackId(item);
  const codeHash = hashText(item.solution.code || "");
  return `${track}:${codeHash}`;
}

export function submissionTrackId(submission) {
  const item = normaliseSubmission(submission);
  const platform = String(item.platform || "leetcode").trim().toLowerCase() || "leetcode";
  const problemKey = String(item.problem.slug || item.problem.id || item.problem.title || "problem")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "problem";
  const language = String(item.solution.language || "unknown").trim().toLowerCase() || "unknown";
  return `${platform}:problem:${problemKey}:${language}`;
}

export function submissionIdentityKeys(submission) {
  const item = normaliseSubmission(submission);
  const keys = new Set([submissionQueueId(item), submissionTrackId(item)]);
  const submissionId = String(item.platformSubmissionId || "").trim();
  if (submissionId && submissionId !== "manual") {
    keys.add(`${item.platform}:submission:${submissionId}`);
    keys.add(`${item.platform}:${submissionId}`);
    keys.add(submissionId);
  }
  return [...keys].filter(Boolean);
}

export function normaliseQueue(rawQueue, legacyPending = []) {
  const source = Array.isArray(rawQueue) && rawQueue.length
    ? rawQueue
    : (Array.isArray(legacyPending) ? legacyPending.map((submission) => ({ submission })) : []);

  const queue = [];

  for (const raw of source) {
    const rawSubmission = raw?.submission && typeof raw.submission === "object"
      ? raw.submission
      : (raw && typeof raw === "object" ? raw : null);
    if (!rawSubmission) continue;

    const submission = normaliseSubmission(rawSubmission);
    if (!submission.problem.title || !submission.solution.code) continue;

    // v1.4.0 could preserve legacy ids such as manual:problem:unknown:...,
    // which allowed duplicate queue entries for the same problem/language.
    // Always rebuild the queue id from the normalised submission instead.
    const id = submissionQueueId(submission);
    const trackId = submissionTrackId(submission);
    if (!id || !trackId) continue;

    const item = {
      id,
      trackId,
      submission,
      state: raw?.state === "failed" ? "failed" : "queued",
      enqueuedAt: raw?.enqueuedAt || new Date().toISOString(),
      attempts: Math.max(0, Number(raw?.attempts) || 0),
      nextAttemptAt: raw?.nextAttemptAt || null,
      lastError: typeof raw?.lastError === "string" ? raw.lastError.slice(0, 500) : ""
    };

    const duplicateIndex = queue.findIndex((entry) =>
      entry.id === item.id || entry.trackId === item.trackId
    );

    if (duplicateIndex >= 0) {
      const previous = queue[duplicateIndex];
      // For the same problem and language, keep the newest queued accepted
      // solution instead of committing several near-identical attempts.
      queue[duplicateIndex] = {
        ...previous,
        ...item,
        enqueuedAt: previous.enqueuedAt || item.enqueuedAt,
        state: item.state === "queued" ? "queued" : previous.state,
        attempts: item.state === "queued" ? 0 : Math.min(previous.attempts, item.attempts),
        nextAttemptAt: item.state === "queued" ? null : (previous.nextAttemptAt || item.nextAttemptAt),
        lastError: item.state === "queued" ? "" : (previous.lastError || item.lastError)
      };
      continue;
    }

    queue.push(item);
    if (queue.length >= MAX_QUEUE_SIZE) break;
  }

  return queue;
}

export function enqueueSubmission(queue, submission, now = new Date().toISOString()) {
  const current = normaliseQueue(queue);
  const normalised = normaliseSubmission(submission);
  const id = submissionQueueId(normalised);
  const trackId = submissionTrackId(normalised);
  const existingIndex = current.findIndex((item) => item.id === id || item.trackId === trackId);

  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    current[existingIndex] = {
      ...existing,
      id,
      trackId,
      submission: normalised,
      state: "queued",
      attempts: 0,
      nextAttemptAt: null,
      lastError: ""
    };
    return { queue: current, item: current[existingIndex], added: false, replaced: true, position: existingIndex + 1 };
  }

  const item = {
    id,
    trackId,
    submission: normalised,
    state: "queued",
    enqueuedAt: now,
    attempts: 0,
    nextAttemptAt: null,
    lastError: ""
  };
  const next = [...current, item].slice(-MAX_QUEUE_SIZE);
  return { queue: next, item, added: true, replaced: false, position: next.findIndex((entry) => entry.id === id) + 1 };
}

export function retryBackoffMs(attempts) {
  const safeAttempts = Math.max(1, Number(attempts) || 1);
  return Math.min(5 * 60_000, 2_000 * (2 ** Math.min(safeAttempts - 1, 7)));
}

export function queueSummary(queue, queueState = {}) {
  const items = normaliseQueue(queue);
  return {
    count: items.length,
    failed: items.filter((item) => item.state === "failed").length,
    busy: queueState?.busy === true,
    activeQueueId: String(queueState?.activeQueueId || ""),
    activeTitle: String(queueState?.activeTitle || ""),
    startedAt: queueState?.startedAt || null
  };
}

export function isQueueItemEligible(item, now = Date.now(), force = false) {
  if (!item) return false;
  if (force) return true;
  if (item.state === "failed") return false;
  if (!item.nextAttemptAt) return true;
  const time = new Date(item.nextAttemptAt).valueOf();
  return !Number.isFinite(time) || time <= now;
}

export function nextEligibleQueueItem(queue, now = Date.now(), force = false) {
  const items = normaliseQueue(queue);
  return items.find((item) => isQueueItemEligible(item, now, force)) || null;
}

export function markQueueForRetry(queue) {
  return normaliseQueue(queue).map((item) => ({
    ...item,
    state: "queued",
    attempts: 0,
    nextAttemptAt: null,
    lastError: ""
  }));
}
