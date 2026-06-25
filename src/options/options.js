const $ = (selector) => document.querySelector(selector);
let savedState = null;
let vaultItems = [];
const selectedVaultIds = new Set();

const THEMES = new Set(["system", "light", "dark"]);
const PALETTES = new Set(["voltage", "acid", "bubblegum", "cobalt", "tangerine"]);

init().catch((error) => setStatus(error.message, "error"));
document.documentElement.addEventListener("solvelog-theme-change", updateQuickThemeButton);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.contestVault) loadVault().catch(() => undefined);
  if (changes.contestSafeMode && savedState) {
    savedState.contestSafeMode = changes.contestSafeMode.newValue !== false;
    $("#contest-safe-mode").checked = savedState.contestSafeMode;
  }
});

async function init() {
  const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  if (!response?.ok) throw new Error(response?.error || "Could not read settings.");
  savedState = response.settings;
  $("#version").textContent = `v${chrome.runtime.getManifest().version}`;
  fillForm(savedState);
  await loadVault();
  if (location.hash === "#contest-vault") {
    requestAnimationFrame(() => $("#contest-vault")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

function fillForm(settings) {
  const mode = settings.syncMode || "github";
  const theme = THEMES.has(settings.theme) ? settings.theme : "system";
  const palette = PALETTES.has(settings.palette) ? settings.palette : "voltage";
  document.querySelector(`input[name="sync-mode"][value="${mode}"]`).checked = true;
  document.querySelector(`input[name="theme"][value="${theme}"]`).checked = true;
  document.querySelector(`input[name="palette"][value="${palette}"]`).checked = true;
  $("#owner").value = settings.owner || "";
  $("#repo").value = settings.repo || "";
  $("#branch").value = settings.branch || "main";
  $("#auto-sync").checked = settings.autoSync !== false;
  $("#contest-safe-mode").checked = settings.contestSafeMode !== false;
  $("#token-state").textContent = settings.hasToken ? "A token is saved locally in this browser." : "No token saved.";
  window.SolveLogTheme.apply(theme);
  window.SolveLogTheme.applyPalette(palette);
  toggleMode();
  updateQuickThemeButton();
}

document.querySelectorAll('input[name="theme"]').forEach((radio) => {
  radio.addEventListener("change", async (event) => {
    const theme = event.target.value;
    window.SolveLogTheme.apply(theme);
    const response = await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings: { theme } });
    if (response?.ok) savedState = response.settings;
  });
});

document.querySelectorAll('input[name="palette"]').forEach((radio) => {
  radio.addEventListener("change", async (event) => {
    const palette = event.target.value;
    window.SolveLogTheme.applyPalette(palette);
    const response = await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings: { palette } });
    if (response?.ok) savedState = response.settings;
  });
});

$("#quick-theme").addEventListener("click", async () => {
  const theme = window.SolveLogTheme.resolved === "dark" ? "light" : "dark";
  window.SolveLogTheme.apply(theme);
  document.querySelector(`input[name="theme"][value="${theme}"]`).checked = true;
  const response = await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings: { theme } });
  if (response?.ok) savedState = response.settings;
  updateQuickThemeButton();
});

document.querySelectorAll('input[name="sync-mode"]').forEach((radio) => radio.addEventListener("change", toggleMode));

$("#auto-sync").addEventListener("change", async () => {
  if (!savedState) return;
  const response = await chrome.runtime.sendMessage({
    type: "SAVE_SETTINGS",
    settings: { autoSync: $("#auto-sync").checked }
  });
  if (response?.ok) savedState = response.settings;
});

$("#contest-safe-mode").addEventListener("change", async () => {
  if (!savedState) return;
  const enabled = $("#contest-safe-mode").checked;
  if (!enabled) {
    const accepted = confirm("Turn off Contest Safe Mode? Future contest solutions may be committed immediately. Existing Vault items will remain local.");
    if (!accepted) {
      $("#contest-safe-mode").checked = true;
      return;
    }
  }
  const response = await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings: { contestSafeMode: enabled } });
  if (!response?.ok) {
    $("#contest-safe-mode").checked = savedState.contestSafeMode !== false;
    setVaultStatus(response?.error || "Could not update Contest Safe Mode.", "error");
    return;
  }
  savedState = response.settings;
  setVaultStatus(enabled ? "Contest Safe Mode is on." : "Contest Safe Mode is off.", "success");
});

function toggleMode() {
  const mode = document.querySelector('input[name="sync-mode"]:checked')?.value || "github";
  $("#github-section").classList.toggle("hidden", mode === "download");
  if (mode === "download") saveDownloadMode().catch((error) => setStatus(error.message, "error"));
}

async function saveDownloadMode() {
  const mode = document.querySelector('input[name="sync-mode"]:checked')?.value;
  if (mode !== "download" || !savedState || savedState.syncMode === "download") return;
  const response = await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings: { syncMode: "download" } });
  if (response?.ok) savedState = response.settings;
}

$("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveForm(false);
});

$("#test-connection").addEventListener("click", async () => saveForm(true));

$("#show-token").addEventListener("click", () => {
  const input = $("#token");
  const revealing = input.type === "password";
  input.type = revealing ? "text" : "password";
  $("#show-token").textContent = revealing ? "HIDE" : "SHOW";
  $("#show-token").setAttribute("aria-label", revealing ? "Hide token" : "Show token");
});

async function saveForm(testAfterSave) {
  setBusy(true);
  setStatus(testAfterSave ? "Saving and checking the connection…" : "Saving changes…", "");
  try {
    const settings = readForm();
    const saved = await chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
    if (!saved?.ok) throw new Error(saved?.error || "Could not save settings.");
    savedState = saved.settings;
    fillForm(savedState);

    if (testAfterSave) {
      const tested = await chrome.runtime.sendMessage({ type: "TEST_CONNECTION" });
      if (!tested?.ok) throw new Error(tested?.error || "Connection test failed.");
      setStatus(`Connected to ${tested.repository.fullName} on ${tested.repository.defaultBranch}.`, "success");
    } else {
      setStatus("Changes saved.", "success");
    }
    clearTokenField();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
}

$("#forget-token").addEventListener("click", async () => {
  if (!confirm("Remove the saved GitHub token from this browser?")) return;
  const response = await chrome.runtime.sendMessage({ type: "FORGET_TOKEN" });
  if (!response?.ok) return setStatus(response?.error || "Could not remove token.", "error");
  savedState = response.settings;
  fillForm(savedState);
  clearTokenField();
  setStatus("Saved token removed.", "success");
});

async function loadVault() {
  const response = await chrome.runtime.sendMessage({ type: "GET_CONTEST_VAULT" });
  if (!response?.ok) throw new Error(response?.error || "Could not read Contest Vault.");
  vaultItems = Array.isArray(response.items) ? response.items : [];
  for (const id of [...selectedVaultIds]) {
    if (!vaultItems.some((item) => item.id === id)) selectedVaultIds.delete(id);
  }
  renderVault();
}

function renderVault() {
  const list = $("#vault-list");
  list.replaceChildren();
  $("#vault-empty").hidden = vaultItems.length > 0;
  $("#select-all-vault").checked = vaultItems.length > 0 && selectedVaultIds.size === vaultItems.length;
  $("#select-all-vault").disabled = vaultItems.length === 0;

  for (const item of vaultItems) {
    const row = document.createElement("article");
    row.className = "vault-item";

    const select = document.createElement("input");
    select.type = "checkbox";
    select.checked = selectedVaultIds.has(item.id);
    select.setAttribute("aria-label", `Select ${item.title}`);
    select.addEventListener("change", () => {
      if (select.checked) selectedVaultIds.add(item.id);
      else selectedVaultIds.delete(item.id);
      updateVaultButtons();
      $("#select-all-vault").checked = vaultItems.length > 0 && selectedVaultIds.size === vaultItems.length;
    });

    const main = document.createElement("div");
    main.className = "vault-item-main";
    const title = document.createElement("h3");
    title.className = "vault-item-title";
    title.textContent = item.title || "Contest solution";
    const meta = document.createElement("div");
    meta.className = "vault-item-meta";
    for (const value of [item.context?.contestTitle || "LeetCode Contest", item.difficulty || "Unknown", languageLabel(item.language)]) {
      const chip = document.createElement("span");
      chip.textContent = value;
      meta.appendChild(chip);
    }
    const stored = document.createElement("p");
    stored.textContent = `Stored locally ${formatDateTime(item.storedAt || item.solvedAt)}. Nothing has been pushed to GitHub.`;
    main.append(title, meta, stored);

    const link = document.createElement("a");
    link.href = item.url || "https://leetcode.com/";
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "OPEN PROBLEM ↗";

    row.append(select, main, link);
    list.appendChild(row);
  }
  updateVaultButtons();
}

$("#select-all-vault").addEventListener("change", (event) => {
  selectedVaultIds.clear();
  if (event.target.checked) vaultItems.forEach((item) => selectedVaultIds.add(item.id));
  renderVault();
});

$("#release-selected").addEventListener("click", () => releaseVault([...selectedVaultIds]));
$("#release-all").addEventListener("click", () => releaseVault(vaultItems.map((item) => item.id)));
$("#discard-selected").addEventListener("click", () => discardVault([...selectedVaultIds]));

async function releaseVault(ids) {
  if (!ids.length) return;
  if (!confirm(`Release ${ids.length} contest solution${ids.length === 1 ? "" : "s"} to the normal save queue?`)) return;
  setVaultBusy(true);
  setVaultStatus("Moving selected solutions into the save queue…", "");
  try {
    const response = await chrome.runtime.sendMessage({ type: "RELEASE_CONTEST_ITEMS", ids });
    if (!response?.ok) throw new Error(response?.error || "Could not release Contest Vault items.");
    selectedVaultIds.clear();
    await loadVault();
    setVaultStatus(`${response.released} solution${response.released === 1 ? "" : "s"} released. SolveLog will save them one at a time.`, "success");
  } catch (error) {
    setVaultStatus(error.message, "error");
  } finally {
    setVaultBusy(false);
  }
}

async function discardVault(ids) {
  if (!ids.length) return;
  if (!confirm(`Permanently remove ${ids.length} local contest solution${ids.length === 1 ? "" : "s"} from Contest Vault?`)) return;
  setVaultBusy(true);
  setVaultStatus("Removing selected local copies…", "");
  try {
    const response = await chrome.runtime.sendMessage({ type: "DISCARD_CONTEST_ITEMS", ids });
    if (!response?.ok) throw new Error(response?.error || "Could not discard Contest Vault items.");
    selectedVaultIds.clear();
    await loadVault();
    setVaultStatus(`${response.discarded} local solution${response.discarded === 1 ? "" : "s"} discarded.`, "success");
  } catch (error) {
    setVaultStatus(error.message, "error");
  } finally {
    setVaultBusy(false);
  }
}

function updateVaultButtons() {
  const selected = selectedVaultIds.size;
  $("#release-selected").disabled = selected === 0;
  $("#discard-selected").disabled = selected === 0;
  $("#release-all").disabled = vaultItems.length === 0;
}

function setVaultBusy(busy) {
  $("#select-all-vault").disabled = busy || vaultItems.length === 0;
  $("#release-selected").disabled = busy || selectedVaultIds.size === 0;
  $("#discard-selected").disabled = busy || selectedVaultIds.size === 0;
  $("#release-all").disabled = busy || vaultItems.length === 0;
}

function readForm() {
  return {
    syncMode: document.querySelector('input[name="sync-mode"]:checked')?.value || "github",
    owner: $("#owner").value,
    repo: $("#repo").value,
    branch: $("#branch").value || "main",
    token: $("#token").value,
    autoSync: $("#auto-sync").checked,
    contestSafeMode: $("#contest-safe-mode").checked,
    theme: document.querySelector('input[name="theme"]:checked')?.value || "system",
    palette: document.querySelector('input[name="palette"]:checked')?.value || "voltage"
  };
}

function clearTokenField() {
  $("#token").value = "";
  $("#token").type = "password";
  $("#show-token").textContent = "SHOW";
  $("#show-token").setAttribute("aria-label", "Show token");
}

function setBusy(busy) {
  $("#settings-form").querySelectorAll("button").forEach((button) => { button.disabled = busy; });
}

function setStatus(message, type) {
  const element = $("#form-status");
  element.textContent = message;
  element.className = `form-status ${type || ""}`;
}

function setVaultStatus(message, type) {
  const element = $("#vault-status");
  element.textContent = message;
  element.className = `form-status ${type || ""}`;
}

function updateQuickThemeButton() {
  const button = $("#quick-theme");
  if (!button) return;
  const next = window.SolveLogTheme.resolved === "dark" ? "light" : "dark";
  button.title = `Switch to ${next} mode`;
  button.setAttribute("aria-label", `Switch to ${next} mode`);
}

function languageLabel(value) {
  const labels = { cpp: "C++", c: "C", java: "Java", python3: "Python", python: "Python", javascript: "JavaScript", typescript: "TypeScript", golang: "Go", rust: "Rust", csharp: "C#", kotlin: "Kotlin", swift: "Swift" };
  return labels[String(value || "").toLowerCase()] || String(value || "Unknown");
}

function formatDateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return "recently";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
