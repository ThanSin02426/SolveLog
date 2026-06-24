import { INDEX_PATH } from "../shared/constants.js";
import { classifyProblem } from "../shared/classifier.js";
import {
  buildCommitMessage,
  buildMetadata,
  buildProblemGeneratedBlock,
  buildRootReadme,
  createRecord,
  mergeProblemReadme,
  problemDirectory,
  solutionFilename,
  updateRecordLanguage
} from "../shared/generators.js";
import {
  assertNonEmptyString,
  isoNow,
  normalizeDifficulty,
  safeJsonParse,
  slugify
} from "../shared/utils.js";
import {
  GitHubClient,
  isRepositoryRace,
  retryDelay
} from "./github-client.js";

const MAX_SYNC_ATTEMPTS = 6;

function validateSubmission(raw) {
  const problem = {
    frontendId: String(raw.frontendId ?? raw.questionFrontendId ?? "").trim(),
    title: String(raw.title ?? "").trim(),
    slug: slugify(raw.slug || raw.title),
    difficulty: normalizeDifficulty(raw.difficulty),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 40) : [],
    language: String(raw.language ?? "").trim().toLowerCase(),
    code: String(raw.code ?? ""),
    runtime: String(raw.runtime ?? "").slice(0, 80),
    memory: String(raw.memory ?? "").slice(0, 80),
    submissionId: String(raw.submissionId ?? "manual").slice(0, 100),
    solvedAt: raw.solvedAt || isoNow(),
    url: String(raw.url || `https://leetcode.com/problems/${slugify(raw.slug || raw.title)}/`),
    syncSource: raw.syncSource === "manual" ? "manual" : "accepted"
  };

  assertNonEmptyString(problem.frontendId, "Problem number", 80);
  assertNonEmptyString(problem.title, "Problem title", 300);
  assertNonEmptyString(problem.slug, "Problem slug", 300);
  assertNonEmptyString(problem.language, "Language", 80);
  assertNonEmptyString(problem.code, "Solution code", 500_000);
  if (!/^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/?/.test(problem.url)) {
    problem.url = `https://leetcode.com/problems/${problem.slug}/`;
  }
  return problem;
}

function emptyIndex() {
  return { schemaVersion: 1, generatedAt: isoNow(), problems: [] };
}

async function prepareAgainstSnapshot(problem, client, headSha) {
  const indexFile = await client.getFile(INDEX_PATH, headSha);
  const index = indexFile ? safeJsonParse(indexFile.text, emptyIndex()) : emptyIndex();
  if (!Array.isArray(index.problems)) index.problems = [];

  let record = index.problems.find((item) => item.slug === problem.slug);
  const isNewProblem = !record;
  const classification = record
    ? { primaryDomain: record.primaryDomain, secondaryDomains: record.secondaryDomains || [] }
    : classifyProblem(problem.tags);

  if (!record) {
    const path = problemDirectory(problem, classification);
    record = createRecord(problem, classification, path);
    index.problems.push(record);
  }

  const isDuplicate = Object.values(record.languages || {}).some(
    (entry) => String(entry.latestSubmissionId) === problem.submissionId && problem.submissionId !== "manual"
  );
  if (isDuplicate) {
    return { duplicate: true, problem, record, index, classification, isNewProblem };
  }

  updateRecordLanguage(record, problem);
  record.tags = problem.tags;
  record.difficulty = problem.difficulty;
  record.url = problem.url;
  index.generatedAt = isoNow();

  const existingReadme = await client.getFile(`${record.path}/README.md`, headSha);
  const generated = buildProblemGeneratedBlock(problem, record);
  const problemReadme = mergeProblemReadme(existingReadme?.text || "", generated);

  const files = [
    { path: `${record.path}/${solutionFilename(problem.language)}`, content: `${problem.code.trimEnd()}\n` },
    { path: `${record.path}/metadata.json`, content: buildMetadata(problem, record) },
    { path: `${record.path}/README.md`, content: `${problemReadme.trimEnd()}\n` },
    { path: INDEX_PATH, content: `${JSON.stringify(index, null, 2)}\n` },
    { path: "README.md", content: buildRootReadme(index) }
  ];

  return { duplicate: false, problem, record, index, classification, isNewProblem, files };
}

export async function syncToGitHub(rawSubmission, settings) {
  const problem = validateSubmission(rawSubmission);
  const client = new GitHubClient(settings);

  await client.initializeIfEmpty(buildRootReadme(emptyIndex()));

  let lastRace = null;
  for (let attempt = 0; attempt < MAX_SYNC_ATTEMPTS; attempt += 1) {
    const head = await client.getHead();
    const prepared = await prepareAgainstSnapshot(problem, client, head.sha);

    if (prepared.duplicate) {
      return {
        duplicate: true,
        problem,
        record: prepared.record,
        commitUrl: null,
        stats: calculateStats(prepared.index)
      };
    }

    try {
      const commit = await client.commitFilesAtHead(
        prepared.files,
        buildCommitMessage(problem, prepared.classification, prepared.isNewProblem),
        head
      );

      return {
        duplicate: false,
        problem,
        record: prepared.record,
        commitUrl: `https://github.com/${settings.owner}/${settings.repo}/commit/${commit.sha}`,
        stats: calculateStats(prepared.index)
      };
    } catch (error) {
      if (!isRepositoryRace(error)) throw error;
      lastRace = error;
      if (attempt < MAX_SYNC_ATTEMPTS - 1) await retryDelay(attempt);
    }
  }

  if (lastRace) {
    lastRace.attempts = MAX_SYNC_ATTEMPTS;
    lastRace.repeated = true;
    throw lastRace;
  }
  throw new Error("SolveLog could not create the GitHub commit.");
}

export function calculateStats(index) {
  const stats = { total: 0, Easy: 0, Medium: 0, Hard: 0 };
  for (const problem of index.problems || []) {
    stats.total += 1;
    if (Object.hasOwn(stats, problem.difficulty)) stats[problem.difficulty] += 1;
  }
  return stats;
}

export function normalizeForExport(rawSubmission) {
  return validateSubmission(rawSubmission);
}
