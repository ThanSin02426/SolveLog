const $ = (selector) => document.querySelector(selector);
let state = null;

const STATUS_LABELS = {
  idle: "READY",
  queued: "IN THE QUEUE",
  syncing: "SAVING NOW",
  success: "FILED AWAY",
  error: "NEEDS A FIX"
};

const PALETTE_NAMES = {
  voltage: "VOLTAGE",
  acid: "ACID",
  bubblegum: "BUBBLEGUM",
  cobalt: "COBALT",
  tangerine: "TANGERINE"
};

init().catch((error) => renderError(error.message));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !state) return;
  const relevant = ["lastStatus", "stats", "syncQueue", "queueState", "autoSync", "syncMode", "owner", "repo", "theme", "palette"];
  if (relevant.some((key) => changes[key])) init().catch(() => undefined);
});

document.documentElement.addEventListener("solvelog-theme-change", updateThemeButton);

async function init() {
  const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  if (!response?.ok) throw new Error(response?.error || "Could not read SolveLog settings.");
  state = response.settings;
  render();
}

function render() {
  const status = state.lastStatus || {};
  const allowedStates = ["idle", "queued", "syncing", "success", "error"];
  const statusState = allowedStates.includes(status.state) ? status.state : "idle";
  const queue = state.queue || { count: 0, failed: 0, busy: false, activeTitle: "" };

  $("#status-label").textContent = STATUS_LABELS[statusState];
  $("#status-message").textContent = friendlyStatusMessage(statusState, status.message);
  $("#status-time").textContent = status.at ? relativeTime(status.at) : "";
  $("#status-icon").className = `status-icon ${statusState}`;
  $("#status-card").dataset.state = statusState;

  $("#total-count").textContent = state.stats?.total || 0;
  $("#easy-count").textContent = state.stats?.Easy || 0;
  $("#medium-count").textContent = state.stats?.Medium || 0;
  $("#hard-count").textContent = state.stats?.Hard || 0;
  $("#auto-sync").checked = state.autoSync !== false;

  $("#pending-count").textContent = queue.count ? ` (${queue.count})` : "";
  $("#retry-pending").disabled = !queue.count || queue.busy;
  $("#manual-sync").disabled = queue.busy;
  $("#auto-sync").disabled = queue.busy;

  const manualLabel = $("#manual-sync .button-label");
  const retryLabel = $("#retry-pending .button-label");
  if (manualLabel) manualLabel.textContent = queue.busy ? "QUEUE IS SAVING…" : "SAVE THIS SOLUTION";
  if (retryLabel) retryLabel.textContent = queue.busy ? "SAVING…" : queue.failed ? "RETRY FAILED" : "RETRY";

  if (queue.busy) {
    $("#queue-caption").textContent = queue.activeTitle
      ? `Saving ${queue.activeTitle}. New solves will wait their turn.`
      : "One GitHub write at a time. New solves will wait their turn.";
  } else if (queue.count) {
    $("#queue-caption").textContent = `${queue.count} submission${queue.count === 1 ? "" : "s"} safely waiting to be saved.`;
  } else {
    $("#queue-caption").textContent = "Accepted solutions are saved one at a time.";
  }

  if (state.syncMode === "download") {
    $("#mode-label").textContent = "DOWNLOAD MODE";
    $("#connection-label").textContent = "ZERO GITHUB ACCESS";
  } else {
    $("#mode-label").textContent = state.owner && state.repo ? `${state.owner}/${state.repo}` : "SETUP NEEDED";
    $("#connection-label").textContent = state.owner && state.repo ? "ONE REPOSITORY ONLY" : "FINISH SETUP";
  }

  $("#open-repository").disabled = state.syncMode !== "github" || !state.owner || !state.repo;
  renderPalette(state.palette || "voltage");
  updateThemeButton();
}

$("#theme-toggle").addEventListener("click", async () => {
  const next = window.SolveLogTheme.resolved === "dark" ? "light" : "dark";
  window.SolveLogTheme.apply(next);
  const response = await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings: { theme: next } });
  if (response?.ok) state = response.settings;
  updateThemeButton();
});

document.querySelectorAll("[data-palette]").forEach((button) => {
  button.addEventListener("click", async () => {
    const palette = button.dataset.palette;
    window.SolveLogTheme.applyPalette(palette);
    renderPalette(palette);
    const response = await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings: { palette } });
    if (response?.ok) state = response.settings;
  });
});

$("#auto-sync").addEventListener("change", async (event) => {
  const response = await chrome.runtime.sendMessage({
    type: "SAVE_SETTINGS",
    settings: { autoSync: event.target.checked }
  });
  if (response?.ok) {
    state = response.settings;
    render();
  }
});

$("#manual-sync").addEventListener("click", async () => {
  setBusy($("#manual-sync"), true, "ADDING TO QUEUE…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.startsWith("https://leetcode.com/problems/")) {
      throw new Error("Open a LeetCode problem first.");
    }
    const response = await chrome.tabs.sendMessage(tab.id, { type: "MANUAL_SYNC" });
    if (!response?.ok) throw new Error(response?.error || "Manual sync failed.");
    await init();
  } catch (error) {
    renderError(error.message);
  } finally {
    if (state) render();
  }
});

$("#retry-pending").addEventListener("click", async () => {
  setBusy($("#retry-pending"), true, "RETRYING…");
  try {
    const response = await chrome.runtime.sendMessage({ type: "RETRY_PENDING" });
    if (!response?.ok) throw new Error(response?.error || "Retry failed.");
    await init();
  } catch (error) {
    renderError(error.message);
  } finally {
    if (state) render();
  }
});

$("#open-repository").addEventListener("click", () => {
  if (state.owner && state.repo) chrome.tabs.create({ url: `https://github.com/${state.owner}/${state.repo}` });
});

$("#open-settings").addEventListener("click", () => chrome.runtime.openOptionsPage());

function renderPalette(palette) {
  const safe = PALETTE_NAMES[palette] ? palette : "voltage";
  $("#palette-name").textContent = PALETTE_NAMES[safe];
  document.querySelectorAll("[data-palette]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.palette === safe));
  });
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  const text = button.querySelector(".button-label");
  if (text) text.textContent = label;
}

function renderError(message) {
  $("#status-label").textContent = STATUS_LABELS.error;
  $("#status-message").textContent = message;
  $("#status-icon").className = "status-icon error";
  $("#status-card").dataset.state = "error";
}

function updateThemeButton() {
  const resolved = window.SolveLogTheme?.resolved || "light";
  const button = $("#theme-toggle");
  if (!button) return;
  const next = resolved === "dark" ? "light" : "dark";
  button.title = `Switch to ${next} mode`;
  button.setAttribute("aria-label", `Switch to ${next} mode`);
}

function friendlyStatusMessage(status, message) {
  if (!message) return "Open a LeetCode problem whenever you’re ready.";
  if (status === "idle" && /waiting for an accepted submission/i.test(message)) {
    return "Solve a problem, or save the current submission by hand.";
  }
  return message;
}

function relativeTime(value) {
  const time = new Date(value).valueOf();
  if (!Number.isFinite(time)) return "";
  const seconds = Math.round((time - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "JUST NOW";
  if (abs < 3600) return `${Math.round(abs / 60)}M AGO`;
  if (abs < 86400) return `${Math.round(abs / 3600)}H AGO`;
  return `${Math.round(abs / 86400)}D AGO`;
}
