const $ = (selector) => document.querySelector(selector);
let savedState = null;

const THEMES = new Set(["system", "light", "dark"]);
const PALETTES = new Set(["voltage", "acid", "bubblegum", "cobalt", "tangerine"]);

init().catch((error) => setStatus(error.message, "error"));
document.documentElement.addEventListener("solvelog-theme-change", updateQuickThemeButton);

async function init() {
  const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  if (!response?.ok) throw new Error(response?.error || "Could not read settings.");
  savedState = response.settings;
  $("#version").textContent = `v${chrome.runtime.getManifest().version}`;
  fillForm(savedState);
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

function readForm() {
  return {
    syncMode: document.querySelector('input[name="sync-mode"]:checked')?.value || "github",
    owner: $("#owner").value,
    repo: $("#repo").value,
    branch: $("#branch").value || "main",
    token: $("#token").value,
    autoSync: $("#auto-sync").checked,
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

function updateQuickThemeButton() {
  const button = $("#quick-theme");
  if (!button) return;
  const next = window.SolveLogTheme.resolved === "dark" ? "light" : "dark";
  button.title = `Switch to ${next} mode`;
  button.setAttribute("aria-label", `Switch to ${next} mode`);
}
