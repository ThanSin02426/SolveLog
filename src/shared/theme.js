(() => {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const themes = new Set(["system", "light", "dark"]);
  const palettes = new Set(["voltage", "acid", "bubblegum", "cobalt", "tangerine"]);
  let preference = "system";
  let palette = "voltage";

  function normaliseTheme(value) {
    return themes.has(value) ? value : "system";
  }

  function normalisePalette(value) {
    return palettes.has(value) ? value : "voltage";
  }

  function resolved(value = preference) {
    return value === "system" ? (media.matches ? "dark" : "light") : value;
  }

  function emit() {
    root.dispatchEvent(new CustomEvent("solvelog-theme-change", {
      detail: { preference, resolved: resolved(), palette }
    }));
  }

  function apply(value) {
    preference = normaliseTheme(value);
    const active = resolved(preference);
    root.dataset.theme = preference;
    root.dataset.resolvedTheme = active;
    root.style.colorScheme = active;
    emit();
    return active;
  }

  function applyPalette(value) {
    palette = normalisePalette(value);
    root.dataset.palette = palette;
    emit();
    return palette;
  }

  function toggle() {
    return apply(resolved() === "dark" ? "light" : "dark");
  }

  window.SolveLogTheme = {
    apply,
    applyPalette,
    toggle,
    get preference() { return preference; },
    get palette() { return palette; },
    get resolved() { return resolved(); }
  };

  apply("system");
  applyPalette("voltage");

  chrome.storage.local.get(["theme", "palette"], (stored) => {
    apply(stored.theme);
    applyPalette(stored.palette);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.theme) apply(changes.theme.newValue);
    if (changes.palette) applyPalette(changes.palette.newValue);
  });

  media.addEventListener("change", () => {
    if (preference === "system") apply("system");
  });
})();
