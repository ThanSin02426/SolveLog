import {
  markReleasedFromVault,
  normaliseSubmission,
  publicSubmissionSummary
} from "../shared/submission-model.js";
import { submissionQueueId } from "./queue-utils.js";

const MAX_VAULT_ITEMS = 100;

export function normaliseContestVault(rawVault) {
  if (!Array.isArray(rawVault)) return [];
  const seen = new Set();
  const items = [];

  for (const raw of rawVault) {
    const submission = normaliseSubmission(raw?.submission || raw || {});
    if (!submission.problem.title || !submission.solution.code) continue;
    const id = String(raw?.id || submissionQueueId(submission));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      submission,
      storedAt: validIso(raw?.storedAt) || submission.capturedAt || new Date().toISOString()
    });
    if (items.length >= MAX_VAULT_ITEMS) break;
  }

  return items;
}

export function vaultSubmission(vault, submission, now = new Date().toISOString()) {
  const current = normaliseContestVault(vault);
  const normalised = normaliseSubmission(submission);
  const id = submissionQueueId(normalised);
  const existingIndex = current.findIndex((item) => item.id === id);

  if (existingIndex >= 0) {
    current[existingIndex] = {
      ...current[existingIndex],
      submission: normalised
    };
    return { vault: current, item: current[existingIndex], added: false };
  }

  if (current.length >= MAX_VAULT_ITEMS) {
    const error = new Error("Contest Vault is full. Release or discard saved contest solutions before adding more.");
    error.code = "CONTEST_VAULT_FULL";
    throw error;
  }

  const item = { id, submission: normalised, storedAt: now };
  return { vault: [...current, item], item, added: true };
}

export function vaultSummary(vault) {
  const items = normaliseContestVault(vault);
  const contests = new Set(items.map((item) => item.submission.context.contestId || "contest"));
  return {
    count: items.length,
    contests: contests.size,
    latestTitle: items.at(-1)?.submission.problem.title || ""
  };
}

export function publicVaultItems(vault) {
  return normaliseContestVault(vault).map((item) => ({
    id: item.id,
    storedAt: item.storedAt,
    ...publicSubmissionSummary(item.submission)
  }));
}

export function selectVaultItems(vault, ids) {
  const selectedIds = new Set(Array.isArray(ids) ? ids.map(String) : []);
  const all = normaliseContestVault(vault);
  const selected = selectedIds.size
    ? all.filter((item) => selectedIds.has(item.id))
    : all;
  return {
    selected,
    remaining: all.filter((item) => !selected.some((chosen) => chosen.id === item.id))
  };
}

export function releaseVaultSubmission(submission) {
  return markReleasedFromVault(submission);
}

function validIso(value) {
  if (!value) return "";
  const time = new Date(value);
  return Number.isFinite(time.valueOf()) ? time.toISOString() : "";
}
