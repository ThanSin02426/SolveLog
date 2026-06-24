import { DEFAULT_SETTINGS } from "../shared/constants.js";
import { normaliseQueue, queueSummary } from "./queue-utils.js";

export async function getSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const syncQueue = normaliseQueue(stored.syncQueue, stored.pendingSubmissions);
  const queueState = {
    ...DEFAULT_SETTINGS.queueState,
    ...(stored.queueState || {})
  };

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    lastStatus: { ...DEFAULT_SETTINGS.lastStatus, ...(stored.lastStatus || {}) },
    stats: { ...DEFAULT_SETTINGS.stats, ...(stored.stats || {}) },
    syncQueue,
    queueState,
    pendingSubmissions: syncQueue.map((item) => item.submission),
    seenSubmissionIds: Array.isArray(stored.seenSubmissionIds) ? stored.seenSubmissionIds : []
  };
}

export async function saveSettings(partial) {
  await chrome.storage.local.set(partial);
  return getSettings();
}

export function publicSettings(settings) {
  const {
    token,
    syncQueue,
    syncLease,
    pendingSubmissions,
    ...safe
  } = settings;

  return {
    ...safe,
    queue: queueSummary(syncQueue, settings.queueState),
    hasToken: Boolean(token)
  };
}
