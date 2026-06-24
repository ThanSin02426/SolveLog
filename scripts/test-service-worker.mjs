import assert from "node:assert/strict";

function eventSlot() {
  const listeners = [];
  return {
    listeners,
    addListener(listener) { listeners.push(listener); }
  };
}

const storageData = {
  syncMode: "download",
  autoSync: true,
  theme: "system",
  palette: "voltage",
  owner: "",
  repo: "",
  branch: "main",
  token: "",
  pendingSubmissions: [],
  syncQueue: [],
  queueState: { busy: false, activeQueueId: "", activeTitle: "", startedAt: null },
  syncLease: null,
  seenSubmissionIds: [],
  stats: { total: 0, Easy: 0, Medium: 0, Hard: 0 },
  lastStatus: { state: "idle", message: "Waiting", at: null }
};

const runtimeOnMessage = eventSlot();
let concurrentDownloads = 0;
let maxConcurrentDownloads = 0;
const downloadOrder = [];

function clone(value) {
  return value == null ? value : structuredClone(value);
}

globalThis.chrome = {
  runtime: {
    onInstalled: eventSlot(),
    onStartup: eventSlot(),
    onMessage: runtimeOnMessage,
    openOptionsPage: async () => undefined,
    getURL: (path) => `chrome-extension://test/${path}`
  },
  alarms: {
    onAlarm: eventSlot(),
    create: () => undefined
  },
  storage: {
    local: {
      async get(keys) {
        if (keys == null) return clone(storageData);
        if (typeof keys === "string") return { [keys]: clone(storageData[keys]) };
        if (Array.isArray(keys)) {
          return Object.fromEntries(keys.map((key) => [key, clone(storageData[key])]).filter(([, value]) => value !== undefined));
        }
        const output = {};
        for (const [key, fallback] of Object.entries(keys || {})) {
          output[key] = clone(key in storageData ? storageData[key] : fallback);
        }
        return output;
      },
      async set(values) {
        Object.assign(storageData, clone(values));
      }
    }
  },
  notifications: {
    create: async () => "notification"
  },
  downloads: {
    async download(options) {
      concurrentDownloads += 1;
      maxConcurrentDownloads = Math.max(maxConcurrentDownloads, concurrentDownloads);
      const name = options.filename;
      await new Promise((resolve) => setTimeout(resolve, 35));
      downloadOrder.push(name);
      concurrentDownloads -= 1;
      return downloadOrder.length;
    }
  }
};

await import("../src/background/service-worker.js");
assert.equal(runtimeOnMessage.listeners.length, 1, "service worker should register one message listener");
const listener = runtimeOnMessage.listeners[0];

function send(message) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("message timed out")), 5000);
    listener(message, { id: "test" }, (response) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
}

function submission(id, title, slug) {
  return {
    frontendId: id,
    title,
    slug,
    difficulty: "Medium",
    tags: ["Array"],
    language: "cpp",
    code: `class Solution { public: int value() { return ${id}; } };`,
    runtime: "1 ms",
    memory: "10 MB",
    submissionId: `submission-${id}`,
    solvedAt: new Date().toISOString(),
    url: `https://leetcode.com/problems/${slug}/`,
    syncSource: "accepted"
  };
}

const first = send({ type: "SUBMISSION_ACCEPTED", submission: submission("1", "First", "first") });
await new Promise((resolve) => setTimeout(resolve, 5));
const second = send({ type: "SUBMISSION_ACCEPTED", submission: submission("2", "Second", "second") });
const responses = await Promise.all([first, second]);

assert.equal(responses.every((response) => response.ok), true);
assert.equal(maxConcurrentDownloads, 1, "queue must never execute two writes concurrently");
assert.equal(downloadOrder.length, 2);
assert.match(downloadOrder[0], /solvelog-1-first\.zip$/);
assert.match(downloadOrder[1], /solvelog-2-second\.zip$/);
assert.deepEqual(storageData.syncQueue, []);
assert.deepEqual(storageData.seenSubmissionIds.slice(0, 2), ["submission-2", "submission-1"]);
assert.equal(storageData.queueState.busy, false);

const duplicate = await send({ type: "SUBMISSION_ACCEPTED", submission: submission("1", "First", "first") });
assert.equal(duplicate.ok, true);
assert.equal(duplicate.duplicate, true);
assert.equal(downloadOrder.length, 2, "seen submissions must not be exported twice");

console.log("Service-worker queue integration tests passed.");
