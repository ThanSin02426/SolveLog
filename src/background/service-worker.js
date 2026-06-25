import { DEFAULT_SETTINGS } from "../shared/constants.js";
import { exportSubmission } from "./exporter.js";
import {
  normaliseContestVault,
  publicVaultItems,
  releaseVaultSubmission,
  selectVaultItems,
  vaultSubmission
} from "./contest-vault.js";
import { GitHubClient } from "./github-client.js";
import {
  enqueueSubmission,
  isQueueItemEligible,
  markQueueForRetry,
  normaliseQueue,
  retryBackoffMs
} from "./queue-utils.js";
import { getSettings, publicSettings, saveSettings } from "./storage.js";
import {
  isContestSubmission,
  normaliseSubmission,
  submissionSeenKey,
  wasSubmissionSeen
} from "../shared/submission-model.js";
import { syncToGitHub } from "./sync-engine.js";

const RETRY_ALARM = "solvelog-retry";
const WAKE_ALARM = "solvelog-queue-wake";
const LEASE_MS = 120_000;
const MAX_ITEMS_PER_DRAIN = 25;
const workerId = typeof crypto?.randomUUID === "function"
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random()}`;

let activeDrainPromise = null;
let storageMutation = Promise.resolve();
const completionResults = new Map();

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const current = await chrome.storage.local.get(null);
  const missing = {};
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(key in current)) missing[key] = value;
  }

  const migratedQueue = normaliseQueue(current.syncQueue, current.pendingSubmissions);
  const migratedVault = normaliseContestVault(current.contestVault);
  await chrome.storage.local.set({
    ...missing,
    syncQueue: migratedQueue,
    contestVault: migratedVault,
    pendingSubmissions: [],
    queueState: { ...DEFAULT_SETTINGS.queueState },
    syncLease: null
  });

  chrome.alarms.create(RETRY_ALARM, { periodInMinutes: 5 });
  if (reason === "install") chrome.runtime.openOptionsPage();
  startDrain({ force: false }).catch(() => undefined);
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(RETRY_ALARM, { periodInMinutes: 5 });
  startDrain({ force: false }).catch(() => undefined);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RETRY_ALARM || alarm.name === WAKE_ALARM) {
    startDrain({ force: false }).catch(() => undefined);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => sendResponse({ ok: true, ...response }))
    .catch((error) => sendResponse({ ok: false, error: friendlyError(error) }));
  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "GET_STATE": {
      const settings = await reconcileStaleQueueState();
      return { settings: publicSettings(settings) };
    }
    case "SAVE_SETTINGS": {
      const settings = await updateSettings(message.settings || {});
      if (settings.syncQueue.length) startDrain({ force: false }).catch(() => undefined);
      return { settings: publicSettings(settings) };
    }
    case "FORGET_TOKEN":
      return { settings: publicSettings(await saveSettings({ token: "" })) };
    case "TEST_CONNECTION":
      return testConnection(message.settings || null);
    case "SUBMISSION_ACCEPTED":
      return queueSubmission(message.submission, sender);
    case "GET_CONTEST_VAULT":
      return getContestVault();
    case "RELEASE_CONTEST_ITEMS":
      return releaseContestItems(message.ids);
    case "DISCARD_CONTEST_ITEMS":
      return discardContestItems(message.ids);
    case "RETRY_PENDING":
      return retryPending();
    default:
      throw new Error("Unknown SolveLog message.");
  }
}

async function queueSubmission(rawSubmission) {
  const submission = normaliseSubmission(rawSubmission);
  const settings = await getSettings();
  const automatic = submission.syncSource !== "manual";
  if (automatic && !settings.autoSync) {
    return { skipped: true, reason: "Automatic sync is disabled." };
  }

  if (settings.contestSafeMode && isContestSubmission(submission) && submission.syncSource !== "contest-release") {
    return storeInContestVault(submission);
  }

  const queued = await withStorageMutation(async () => {
    const current = await getSettings();
    if (wasSubmissionSeen(current.seenSubmissionIds, submission)) {
      return { duplicate: true, item: null, position: 0 };
    }

    const result = enqueueSubmission(current.syncQueue, submission);
    await chrome.storage.local.set({
      syncQueue: result.queue,
      pendingSubmissions: [],
      lastStatus: {
        state: "queued",
        message: result.position > 1
          ? `${submission.problem.title || "Submission"} is queued behind ${result.position - 1} other save${result.position === 2 ? "" : "s"}.`
          : `${submission.problem.title || "Submission"} is queued for saving.`,
        at: new Date().toISOString()
      }
    });
    return { ...result, duplicate: false };
  });

  if (queued.duplicate) return { duplicate: true };

  // Keep the message event alive until the queue has had a chance to process.
  // A second Accepted event joins the same drain instead of starting a second
  // GitHub write.
  await ensureItemGetsDrainTurn(queued.item.id);

  const after = await getSettings();
  const remaining = after.syncQueue.find((item) => item.id === queued.item.id);
  if (!remaining) {
    const completed = completionResults.get(queued.item.id) || null;
    completionResults.delete(queued.item.id);
    return {
      queued: false,
      saved: true,
      exported: completed?.exported === true,
      duplicate: completed?.duplicate === true,
      result: completed
    };
  }
  if (remaining.state === "failed") {
    const error = new Error(remaining.lastError || "SolveLog could not save this submission.");
    error.code = "QUEUE_ITEM_FAILED";
    throw error;
  }

  return {
    queued: true,
    saved: false,
    position: after.syncQueue.findIndex((item) => item.id === queued.item.id) + 1
  };
}


async function storeInContestVault(submission) {
  return withStorageMutation(async () => {
    const current = await getSettings();
    if (wasSubmissionSeen(current.seenSubmissionIds, submission)) {
      return { duplicate: true };
    }

    const result = vaultSubmission(current.contestVault, submission);
    await chrome.storage.local.set({
      contestVault: result.vault,
      lastStatus: {
        state: "vaulted",
        message: `${submission.problem.title || "Contest solution"} is safe in Contest Vault. Release it after the contest.`,
        at: new Date().toISOString()
      }
    });

    notify("Saved to Contest Vault", submission.problem.title || "Contest solution");
    return {
      vaulted: true,
      duplicate: !result.added,
      vaultCount: result.vault.length
    };
  });
}

async function getContestVault() {
  const settings = await getSettings();
  return { items: publicVaultItems(settings.contestVault) };
}

async function releaseContestItems(ids) {
  const result = await withStorageMutation(async () => {
    const current = await getSettings();
    const { selected, remaining } = selectVaultItems(current.contestVault, ids);
    if (!selected.length) return { released: 0, remaining: current.contestVault.length };

    let queue = current.syncQueue;
    for (const item of selected) {
      queue = enqueueSubmission(queue, releaseVaultSubmission(item.submission)).queue;
    }

    await chrome.storage.local.set({
      contestVault: remaining,
      syncQueue: queue,
      pendingSubmissions: [],
      lastStatus: {
        state: "queued",
        message: `${selected.length} contest solution${selected.length === 1 ? "" : "s"} released to the save queue.`,
        at: new Date().toISOString()
      }
    });

    return { released: selected.length, remaining: remaining.length, queueCount: queue.length };
  });

  if (result.released) startDrain({ force: false }).catch(() => undefined);
  return result;
}

async function discardContestItems(ids) {
  return withStorageMutation(async () => {
    const current = await getSettings();
    const { selected, remaining } = selectVaultItems(current.contestVault, ids);
    if (!selected.length) return { discarded: 0, remaining: current.contestVault.length };

    await chrome.storage.local.set({
      contestVault: remaining,
      lastStatus: {
        state: remaining.length ? "vaulted" : "idle",
        message: remaining.length
          ? `${remaining.length} contest solution${remaining.length === 1 ? " remains" : "s remain"} in Contest Vault.`
          : "Contest Vault is empty.",
        at: new Date().toISOString()
      }
    });

    return { discarded: selected.length, remaining: remaining.length };
  });
}

async function ensureItemGetsDrainTurn(queueId) {
  for (let pass = 0; pass < 3; pass += 1) {
    await startDrain({ force: false });
    const settings = await getSettings();
    const item = settings.syncQueue.find((entry) => entry.id === queueId);
    if (!item || item.state === "failed" || !isQueueItemEligible(item)) return;
  }
}

function startDrain(options = {}) {
  if (activeDrainPromise) return activeDrainPromise;

  activeDrainPromise = drainQueue(options)
    .finally(async () => {
      activeDrainPromise = null;
      const settings = await getSettings().catch(() => null);
      const first = settings?.syncQueue?.[0];
      if (first && isQueueItemEligible(first)) {
        // A submission may have arrived just as the prior drain observed an
        // empty queue. The next event/message will await this new drain.
        queueMicrotask(() => startDrain({ force: false }).catch(() => undefined));
      }
    });

  return activeDrainPromise;
}

async function drainQueue({ force = false } = {}) {
  const lease = await acquireLease();
  if (!lease) return { busy: true, processed: 0 };

  let processed = 0;
  try {
    await updateQueueState({ busy: true, activeQueueId: "", activeTitle: "", startedAt: new Date().toISOString() });

    while (processed < MAX_ITEMS_PER_DRAIN) {
      const settings = await getSettings();
      const item = settings.syncQueue[0];
      if (!item) break;

      if (!isQueueItemEligible(item, Date.now(), force)) {
        if (item.nextAttemptAt) scheduleWake(item.nextAttemptAt);
        break;
      }

      await renewLease(lease);
      await updateQueueState({
        busy: true,
        activeQueueId: item.id,
        activeTitle: item.submission?.problem?.title || "Submission",
        startedAt: new Date().toISOString()
      });
      await setStatus(
        "syncing",
        settings.syncQueue.length > 1
          ? `Saving ${item.submission?.problem?.title || "submission"} · ${settings.syncQueue.length - 1} more waiting.`
          : `Saving ${item.submission?.problem?.title || "submission"}…`
      );

      try {
        const result = await performSubmission(item.submission, settings);
        await completeQueueItem(item, result);
        processed += 1;
      } catch (error) {
        const transient = isTransientSyncError(error);
        const failure = await failQueueItem(item, error, transient);

        if (transient && failure.nextAttemptAt) scheduleWake(failure.nextAttemptAt);
        if (!transient) notify("SolveLog needs attention", friendlyError(error));
        break;
      }
    }

    return { busy: false, processed };
  } finally {
    await updateQueueState({ ...DEFAULT_SETTINGS.queueState }).catch(() => undefined);
    await releaseLease(lease).catch(() => undefined);
  }
}

async function performSubmission(submission, settings) {
  if (settings.syncMode === "download") {
    const result = await exportSubmission(submission);
    return { exported: true, problem: result.problem, stats: settings.stats, duplicate: false };
  }

  requireGitHubSettings(settings);
  return syncToGitHub(submission, settings);
}

async function completeQueueItem(item, result) {
  completionResults.set(item.id, result || {});
  if (completionResults.size > 100) {
    completionResults.delete(completionResults.keys().next().value);
  }

  const title = result?.problem?.title || item.submission?.problem?.title || "Submission";
  const seenKey = submissionSeenKey(item.submission);

  await withStorageMutation(async () => {
    const current = await getSettings();
    const nextQueue = current.syncQueue.filter((entry) => entry.id !== item.id);
    const seen = seenKey
      ? [seenKey, ...current.seenSubmissionIds.filter((id) => id !== seenKey)].slice(0, 500)
      : current.seenSubmissionIds;

    const remaining = nextQueue.length;
    const message = result?.duplicate
      ? `${title} was already saved.${remaining ? ` ${remaining} more waiting.` : ""}`
      : result?.exported
        ? `Downloaded ${title}.${remaining ? ` ${remaining} more waiting.` : ""}`
        : `Filed ${title}.${remaining ? ` ${remaining} more waiting.` : ""}`;

    await chrome.storage.local.set({
      syncQueue: nextQueue,
      pendingSubmissions: [],
      seenSubmissionIds: seen,
      stats: result?.stats || current.stats,
      lastStatus: {
        state: remaining ? "queued" : "success",
        message,
        at: new Date().toISOString()
      }
    });
  });

  notify(
    result?.duplicate ? "Already saved" : result?.exported ? "Solution exported" : "Committed to GitHub",
    `${result?.problem?.frontendId || item.submission?.problem?.id || ""}. ${title}`.trim()
  );
}

async function failQueueItem(item, error, transient) {
  const message = friendlyError(error);
  let updated = null;

  await withStorageMutation(async () => {
    const current = await getSettings();
    const queue = current.syncQueue.map((entry) => {
      if (entry.id !== item.id) return entry;
      const attempts = (Number(entry.attempts) || 0) + 1;
      const nextAttemptAt = transient
        ? new Date(Date.now() + retryBackoffMs(attempts)).toISOString()
        : null;
      updated = {
        ...entry,
        attempts,
        state: transient ? "queued" : "failed",
        nextAttemptAt,
        lastError: message
      };
      return updated;
    });

    await chrome.storage.local.set({
      syncQueue: queue,
      pendingSubmissions: [],
      lastStatus: {
        state: transient ? "queued" : "error",
        message: transient
          ? `${item.submission?.problem?.title || "Submission"} is safe in the queue. SolveLog will retry automatically.`
          : message,
        at: new Date().toISOString()
      }
    });
  });

  return updated || item;
}

async function retryPending() {
  const settings = await withStorageMutation(async () => {
    const current = await getSettings();
    const queue = markQueueForRetry(current.syncQueue);
    await chrome.storage.local.set({
      syncQueue: queue,
      pendingSubmissions: [],
      lastStatus: {
        state: queue.length ? "queued" : current.lastStatus.state,
        message: queue.length ? `${queue.length} saved submission${queue.length === 1 ? "" : "s"} queued for retry.` : current.lastStatus.message,
        at: queue.length ? new Date().toISOString() : current.lastStatus.at
      }
    });
    return getSettings();
  });

  if (!settings.syncQueue.length) return { retried: 0, remaining: 0 };
  await startDrain({ force: true });
  const after = await getSettings();
  return {
    retried: Math.max(0, settings.syncQueue.length - after.syncQueue.length),
    remaining: after.syncQueue.length
  };
}

async function updateSettings(input) {
  const current = await getSettings();
  const next = {};

  if (Object.hasOwn(input, "syncMode")) {
    next.syncMode = input.syncMode === "download" ? "download" : "github";
  }
  if (Object.hasOwn(input, "autoSync")) {
    next.autoSync = input.autoSync !== false;
  }
  if (Object.hasOwn(input, "contestSafeMode")) {
    next.contestSafeMode = input.contestSafeMode !== false;
  }
  if (Object.hasOwn(input, "owner")) {
    next.owner = cleanName(input.owner, current.owner);
  }
  if (Object.hasOwn(input, "repo")) {
    next.repo = cleanName(input.repo, current.repo);
  }
  if (Object.hasOwn(input, "branch")) {
    next.branch = cleanName(input.branch, current.branch || "main");
  }
  if (Object.hasOwn(input, "theme")) {
    next.theme = normaliseTheme(input.theme, current.theme);
  }
  if (Object.hasOwn(input, "palette")) {
    next.palette = normalisePalette(input.palette, current.palette);
  }
  if (typeof input.token === "string" && input.token.trim()) {
    next.token = input.token.trim();
  }

  return saveSettings(next);
}

async function testConnection(temporarySettings) {
  const current = await getSettings();
  const merged = {
    ...current,
    ...(temporarySettings || {}),
    token: temporarySettings?.token?.trim() || current.token
  };
  requireGitHubSettings(merged);
  const client = new GitHubClient(merged);
  const repository = await client.verify();
  if (!temporarySettings?.branch && repository.defaultBranch) {
    await saveSettings({ branch: repository.defaultBranch });
  }
  return { repository };
}

function requireGitHubSettings(settings) {
  if (!settings.token) throw new Error("Add a repository-scoped GitHub token in SolveLog settings.");
  if (!settings.owner || !settings.repo) throw new Error("Choose the GitHub repository in SolveLog settings.");
  if (!settings.branch) throw new Error("Set the repository branch.");
}

function cleanName(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, 200);
}

function normaliseTheme(value, fallback = "system") {
  return ["system", "light", "dark"].includes(value) ? value : fallback;
}

function normalisePalette(value, fallback = "voltage") {
  return ["voltage", "acid", "bubblegum", "cobalt", "tangerine"].includes(value) ? value : fallback;
}

function isTransientSyncError(error) {
  if (!error) return false;
  if (["BRANCH_MOVED", "INITIALIZATION_PENDING"].includes(error.code)) return true;
  if (error.status === 409 || error.status === 429) return true;
  if (Number(error.status) >= 500) return true;
  const text = String(error.message || error).toLowerCase();
  return error.name === "TypeError" || /failed to fetch|network error|temporarily unavailable|timeout/.test(text);
}

async function setStatus(state, message) {
  await chrome.storage.local.set({
    lastStatus: { state, message, at: new Date().toISOString() }
  });
}

async function updateQueueState(queueState) {
  await chrome.storage.local.set({ queueState });
}

async function withStorageMutation(task) {
  const run = storageMutation.then(task, task);
  storageMutation = run.catch(() => undefined);
  return run;
}

async function acquireLease() {
  const now = Date.now();
  const current = (await chrome.storage.local.get("syncLease")).syncLease;
  if (current?.owner && current.owner !== workerId && Number(current.expiresAt) > now) {
    return null;
  }

  const lease = { owner: workerId, expiresAt: now + LEASE_MS };
  await chrome.storage.local.set({ syncLease: lease });
  const verified = (await chrome.storage.local.get("syncLease")).syncLease;
  return verified?.owner === workerId ? lease : null;
}

async function renewLease(lease) {
  if (!lease || lease.owner !== workerId) throw new Error("SolveLog lost its queue lock.");
  lease.expiresAt = Date.now() + LEASE_MS;
  await chrome.storage.local.set({ syncLease: lease });
}

async function releaseLease(lease) {
  const current = (await chrome.storage.local.get("syncLease")).syncLease;
  if (current?.owner === lease?.owner) await chrome.storage.local.set({ syncLease: null });
}

async function reconcileStaleQueueState() {
  const settings = await getSettings();
  if (!settings.queueState.busy) return settings;

  const lease = settings.syncLease;
  if (lease?.owner && Number(lease.expiresAt) > Date.now()) return settings;

  await chrome.storage.local.set({
    queueState: { ...DEFAULT_SETTINGS.queueState },
    syncLease: null
  });
  return getSettings();
}

function scheduleWake(value) {
  const when = new Date(value).valueOf();
  if (!Number.isFinite(when)) return;
  chrome.alarms.create(WAKE_ALARM, { when: Math.max(Date.now() + 1_000, when) });
}

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("assets/icons/icon-128.png"),
    title,
    message: String(message).slice(0, 180)
  }).catch(() => undefined);
}

function friendlyError(error) {
  if (!error) return "Unexpected error.";
  if (error.code === "QUEUE_ITEM_FAILED") return String(error.message || "This queued submission needs attention.").slice(0, 300);
  if (error.code === "CONTEST_VAULT_FULL") return String(error.message).slice(0, 300);

  const details = (() => {
    try { return JSON.stringify(error.payload || {}).toLowerCase(); } catch { return ""; }
  })();
  const text = `${error.message || ""} ${details}`.toLowerCase();

  if (error.status === 401) return "GitHub rejected the token. Create a new fine-grained token.";
  if (error.status === 403) return "The token cannot write to this repository. Grant Contents: Read and write.";
  if (error.status === 404) return "Repository or branch not found, or the token cannot access it.";
  if (error.code === "EMPTY_REPOSITORY") {
    return "This repository has no first commit yet. SolveLog will initialise it automatically.";
  }
  if (error.code === "INITIALIZATION_PENDING") {
    return "GitHub is still creating the repository's first branch. The submission is queued and will retry automatically.";
  }
  if (/protected branch|repository rule|ruleset|required status|signed commit/.test(text)) {
    return "GitHub rules are blocking direct commits to this branch. Use an unprotected branch or relax that repository rule.";
  }
  if (error.code === "BRANCH_MOVED" || error.status === 409) {
    return "The repository changed during the save. The submission is queued and will retry from the latest branch version.";
  }
  if (error.status === 422) return "GitHub rejected the commit. Check the branch name and repository rules in Settings.";
  return String(error.message || error).slice(0, 300);
}
