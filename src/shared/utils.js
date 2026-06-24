import { LANGUAGE_EXTENSIONS, LANGUAGE_LABELS } from "./constants.js";

export function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function sanitizePathSegment(value, fallback = "other") {
  const clean = String(value ?? "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "")
    .replace(/^-+|-+$/g, "");
  return clean || fallback;
}

export function formatProblemId(frontendId, slug) {
  const raw = String(frontendId ?? "").trim();
  if (/^\d+$/.test(raw)) return raw.padStart(4, "0");
  const normal = sanitizePathSegment(raw, "problem").toUpperCase();
  return `${normal}-${slugify(slug).slice(0, 24)}`;
}

export function extensionForLanguage(language) {
  const key = String(language ?? "").toLowerCase();
  return LANGUAGE_EXTENSIONS[key] || sanitizePathSegment(key, "txt");
}

export function languageLabel(language) {
  const key = String(language ?? "").toLowerCase();
  return LANGUAGE_LABELS[key] || String(language || "Unknown");
}

export function normalizeDifficulty(value) {
  const candidate = String(value ?? "").toLowerCase();
  if (candidate === "easy") return "Easy";
  if (candidate === "medium") return "Medium";
  if (candidate === "hard") return "Hard";
  return "Unknown";
}

export function isoNow() {
  return new Date().toISOString();
}

export function formatDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.valueOf())) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  }).format(date);
}

export function escapeMarkdown(value) {
  return String(value ?? "").replace(/([\\`*_[\]<>|])/g, "\\$1");
}

export function compareProblemIds(a, b) {
  const aNum = Number.parseInt(String(a.frontendId), 10);
  const bNum = Number.parseInt(String(b.frontendId), 10);
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) return aNum - bNum;
  return String(a.frontendId).localeCompare(String(b.frontendId));
}

export function assertNonEmptyString(value, name, maxLength = 200_000) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required.`);
  }
  if (value.length > maxLength) {
    throw new Error(`${name} is too large.`);
  }
  return value;
}

export function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
