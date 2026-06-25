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

  const slug = String(item.problem.slug || item.problem.title || "problem").trim().toLowerCase();
  const language = String(item.solution.language || "unknown").trim().toLowerCase();
  const codeHash = hashText(item.solution.code || "");
  return `${item.platform}:manual:${slug}:${language}:${codeHash}`;
}

export function normaliseQueue(rawQueue, legacyPending = []) {
  const source = Array.isArray(rawQueue) && rawQueue.length
    ? rawQueue
    : (Array.isArray(legacyPending) ? legacyPending.map((submission) => ({ submission })) : []);

  const seen = new Set();
  const queue = [];

  for (const raw of source) {
    const rawSubmission = raw?.submission && typeof raw.submission === "object"
      ? raw.submission
      : (raw && typeof raw === "object" ? raw : null);
    if (!rawSubmission) continue;

    const submission = normaliseSubmission(rawSubmission);
    if (!submission.problem.title || !submission.solution.code) continue;
    const id = String(raw?.id || submissionQueueId(submission));
    if (!id || seen.has(id)) continue;
    seen.add(id);

    queue.push({
      id,
      submission,
      state: raw?.state === "failed" ? "failed" : "queued",
      enqueuedAt: raw?.enqueuedAt || new Date().toISOString(),
      attempts: Math.max(0, Number(raw?.attempts) || 0),
      nextAttemptAt: raw?.nextAttemptAt || null,
      lastError: typeof raw?.lastError === "string" ? raw.lastError.slice(0, 500) : ""
    });

    if (queue.length >= MAX_QUEUE_SIZE) break;
  }

  return queue;
}

export function enqueueSubmission(queue, submission, now = new Date().toISOString()) {
  const current = normaliseQueue(queue);
  const normalised = normaliseSubmission(submission);
  const id = submissionQueueId(normalised);
  const existingIndex = current.findIndex((item) => item.id === id);

  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    current[existingIndex] = {
      ...existing,
      submission: normalised,
      state: existing.state === "failed" ? "failed" : "queued"
    };
    return { queue: current, item: current[existingIndex], added: false, position: existingIndex + 1 };
  }

  const item = {
    id,
    submission: normalised,
    state: "queued",
    enqueuedAt: now,
    attempts: 0,
    nextAttemptAt: null,
    lastError: ""
  };
  const next = [...current, item].slice(-MAX_QUEUE_SIZE);
  return { queue: next, item, added: true, position: next.findIndex((entry) => entry.id === id) + 1 };
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

export function markQueueForRetry(queue) {
  return normaliseQueue(queue).map((item) => ({
    ...item,
    state: "queued",
    nextAttemptAt: null,
    lastError: ""
  }));
}
