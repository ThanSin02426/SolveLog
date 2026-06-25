import { isoNow, normalizeDifficulty, slugify } from "./utils.js";

export const SUBMISSION_SCHEMA_VERSION = 2;
export const SUPPORTED_PLATFORMS = Object.freeze(["leetcode"]);

export function normaliseSubmission(raw = {}) {
  const problemInput = raw.problem && typeof raw.problem === "object" ? raw.problem : raw;
  const solutionInput = raw.solution && typeof raw.solution === "object" ? raw.solution : raw;
  const contextInput = raw.context && typeof raw.context === "object" ? raw.context : {};

  const platform = cleanLower(raw.platform || raw.sourcePlatform || "leetcode", "leetcode", 40);
  const title = clean(problemInput.title || raw.title, "", 300);
  const slug = slugify(problemInput.slug || raw.slug || title);
  const platformSubmissionId = clean(
    raw.platformSubmissionId || raw.submissionId || solutionInput.submissionId || "manual",
    "manual",
    120
  );
  const solvedAt = validIso(raw.solvedAt || raw.capturedAt || solutionInput.solvedAt) || isoNow();
  const contextKind = contextInput.kind === "contest" || raw.contest === true ? "contest" : "practice";

  const normalised = {
    schemaVersion: SUBMISSION_SCHEMA_VERSION,
    platform,
    platformSubmissionId,
    problem: {
      id: clean(problemInput.id || problemInput.frontendId || problemInput.questionFrontendId, "", 80),
      title,
      slug,
      difficulty: normalizeDifficulty(problemInput.difficulty || raw.difficulty),
      tags: Array.isArray(problemInput.tags || raw.tags)
        ? [...new Set((problemInput.tags || raw.tags).map((tag) => clean(tag, "", 80)).filter(Boolean))].slice(0, 40)
        : [],
      url: clean(problemInput.url || raw.url || defaultProblemUrl(platform, slug), defaultProblemUrl(platform, slug), 1_000)
    },
    solution: {
      language: cleanLower(solutionInput.language || raw.language, "", 80),
      code: String(solutionInput.code ?? raw.code ?? ""),
      runtime: clean(solutionInput.runtime || raw.runtime, "", 80),
      memory: clean(solutionInput.memory || raw.memory, "", 80)
    },
    context: {
      kind: contextKind,
      contestId: clean(contextInput.contestId || raw.contestId, "", 160),
      contestTitle: clean(contextInput.contestTitle || raw.contestTitle, "", 240),
      contestUrl: clean(contextInput.contestUrl || raw.contestUrl, "", 1_000),
      releasedFromVault: contextInput.releasedFromVault === true || raw.releasedFromVault === true
    },
    solvedAt,
    capturedAt: validIso(raw.capturedAt) || solvedAt,
    syncSource: normaliseSyncSource(raw.syncSource)
  };

  return normalised;
}

export function createSubmission({
  platform = "leetcode",
  platformSubmissionId = "manual",
  problem = {},
  solution = {},
  context = {},
  solvedAt = isoNow(),
  capturedAt = solvedAt,
  syncSource = "accepted"
} = {}) {
  return normaliseSubmission({
    schemaVersion: SUBMISSION_SCHEMA_VERSION,
    platform,
    platformSubmissionId,
    problem,
    solution,
    context,
    solvedAt,
    capturedAt,
    syncSource
  });
}

export function isContestSubmission(submission) {
  return normaliseSubmission(submission).context.kind === "contest";
}

export function markReleasedFromVault(submission) {
  const current = normaliseSubmission(submission);
  return normaliseSubmission({
    ...current,
    syncSource: "contest-release",
    context: {
      ...current.context,
      releasedFromVault: true
    }
  });
}

export function submissionSeenKey(submission) {
  const item = normaliseSubmission(submission);
  const id = String(item.platformSubmissionId || "").trim();
  return id && id !== "manual" ? `${item.platform}:${id}` : "";
}

export function wasSubmissionSeen(seenIds, submission) {
  const item = normaliseSubmission(submission);
  const id = String(item.platformSubmissionId || "").trim();
  const key = submissionSeenKey(item);
  const values = Array.isArray(seenIds) ? seenIds.map(String) : [];
  return Boolean(key && (values.includes(key) || values.includes(id)));
}

export function publicSubmissionSummary(submission) {
  const item = normaliseSubmission(submission);
  return {
    schemaVersion: item.schemaVersion,
    platform: item.platform,
    submissionId: item.platformSubmissionId,
    frontendId: item.problem.id,
    title: item.problem.title,
    slug: item.problem.slug,
    difficulty: item.problem.difficulty,
    language: item.solution.language,
    url: item.problem.url,
    solvedAt: item.solvedAt,
    context: { ...item.context }
  };
}

export function legacySubmissionView(submission) {
  const item = submission;
  return {
    ...item,
    submissionId: item.platformSubmissionId,
    frontendId: item.problem.id,
    title: item.problem.title,
    slug: item.problem.slug,
    difficulty: item.problem.difficulty,
    tags: item.problem.tags,
    url: item.problem.url,
    language: item.solution.language,
    code: item.solution.code,
    runtime: item.solution.runtime,
    memory: item.solution.memory,
    contestId: item.context.contestId,
    contestTitle: item.context.contestTitle,
    contestUrl: item.context.contestUrl
  };
}

export function defaultProblemUrl(platform, slug) {
  if (platform === "leetcode" && slug) return `https://leetcode.com/problems/${slug}/`;
  return "";
}

function normaliseSyncSource(value) {
  const allowed = new Set(["accepted", "manual", "contest-release", "import"]);
  return allowed.has(value) ? value : "accepted";
}

function clean(value, fallback = "", max = 300) {
  const text = typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
  return (text || fallback).slice(0, max);
}

function cleanLower(value, fallback = "", max = 80) {
  return clean(value, fallback, max).toLowerCase();
}

function validIso(value) {
  if (!value) return "";
  const time = new Date(value);
  return Number.isFinite(time.valueOf()) ? time.toISOString() : "";
}
