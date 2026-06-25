import {
  GENERATED_END,
  GENERATED_START
} from "./constants.js";
import {
  compareProblemIds,
  escapeMarkdown,
  extensionForLanguage,
  formatDate,
  formatProblemId,
  languageLabel,
  sanitizePathSegment,
  slugify
} from "./utils.js";

export function problemDirectory(problem, classification) {
  const id = formatProblemId(problem.frontendId, problem.slug);
  const folder = `${id}-${slugify(problem.slug || problem.title)}`;
  return [
    sanitizePathSegment(classification.primaryDomain, "Other"),
    sanitizePathSegment(problem.difficulty, "Unknown"),
    sanitizePathSegment(folder, id)
  ].join("/");
}

export function solutionFilename(language) {
  return `solution.${extensionForLanguage(language)}`;
}

export function buildProblemGeneratedBlock(problem, record) {
  const languages = Object.values(record.languages || {})
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));
  const tags = (problem.tags || []).map((tag) => `\`${escapeMarkdown(tag)}\``).join(" ") || "None reported";
  const secondary = (record.secondaryDomains || []).join(", ") || "—";
  const rows = languages.map((entry) => {
    const fileLink = `./${entry.filename}`;
    return `| [${escapeMarkdown(entry.label)}](${fileLink}) | ${escapeMarkdown(entry.runtime || "—")} | ${escapeMarkdown(entry.memory || "—")} | ${formatDate(entry.solvedAt)} |`;
  }).join("\n");
  const platformLabel = displayPlatform(problem.platform);

  return `${GENERATED_START}\n# ${escapeMarkdown(problem.frontendId)}. ${escapeMarkdown(problem.title)}\n\n` +
    `> ${escapeMarkdown(problem.difficulty)} · ${escapeMarkdown(record.primaryDomain)} · ${escapeMarkdown(platformLabel)}\n\n` +
    `- **Problem:** [Open on ${escapeMarkdown(platformLabel)}](${problem.url})\n` +
    `- **Primary topic:** ${escapeMarkdown(record.primaryDomain)}\n` +
    `- **Related topics:** ${escapeMarkdown(secondary)}\n` +
    `- **Tags:** ${tags}\n\n` +
    `## Accepted solutions\n\n` +
    `| Language | Runtime | Memory | Saved |\n` +
    `|---|---:|---:|---|\n` +
    `${rows || "| — | — | — | — |"}\n\n` +
    `${GENERATED_END}`;
}

export function mergeProblemReadme(existingText, generatedBlock) {
  const notesTemplate = `## Notes\n\n<!-- This section is yours. SolveLog preserves everything below the generated block. -->\n\n` +
    `### Approach\n\n` +
    `Write the key observation and reasoning here.\n\n` +
    `### Complexity\n\n` +
    `- Time: \`O(?)\`\n` +
    `- Space: \`O(?)\`\n`;

  if (!existingText || !existingText.trim()) {
    return `${generatedBlock}\n\n${notesTemplate}`;
  }

  const start = existingText.indexOf(GENERATED_START);
  const end = existingText.indexOf(GENERATED_END);
  if (start >= 0 && end > start) {
    const tail = existingText.slice(end + GENERATED_END.length).trimStart();
    return `${generatedBlock}\n\n${tail || notesTemplate}`;
  }

  return `${generatedBlock}\n\n## Previous README content\n\n${existingText.trim()}\n`;
}

export function buildMetadata(problem, record) {
  return JSON.stringify({
    schemaVersion: 2,
    platform: problem.platform || "leetcode",
    source: problem.url,
    frontendId: problem.frontendId,
    title: problem.title,
    slug: problem.slug,
    difficulty: problem.difficulty,
    url: problem.url,
    primaryDomain: record.primaryDomain,
    secondaryDomains: record.secondaryDomains || [],
    tags: problem.tags || [],
    languages: record.languages || {},
    lastContext: problem.context || { kind: "practice" },
    updatedAt: record.updatedAt
  }, null, 2) + "\n";
}

function difficultyRank(value) {
  return { Easy: 0, Medium: 1, Hard: 2, Unknown: 3 }[value] ?? 4;
}

export function buildRootReadme(index) {
  const problems = [...(index.problems || [])].sort((a, b) => {
    const domain = String(a.primaryDomain).localeCompare(String(b.primaryDomain));
    if (domain) return domain;
    const difficulty = difficultyRank(a.difficulty) - difficultyRank(b.difficulty);
    if (difficulty) return difficulty;
    return compareProblemIds(a, b);
  });

  const stats = { Easy: 0, Medium: 0, Hard: 0, Unknown: 0 };
  for (const item of problems) stats[item.difficulty] = (stats[item.difficulty] || 0) + 1;

  const byDomain = new Map();
  for (const item of problems) {
    if (!byDomain.has(item.primaryDomain)) byDomain.set(item.primaryDomain, []);
    byDomain.get(item.primaryDomain).push(item);
  }

  const sections = [];
  for (const [domain, entries] of byDomain) {
    const rows = entries.map((item) => {
      const languageNames = Object.values(item.languages || {})
        .map((language) => language.label)
        .sort()
        .join(", ");
      return `| ${escapeMarkdown(item.frontendId)} | [${escapeMarkdown(item.title)}](${item.path}) | ${item.difficulty} | ${escapeMarkdown(languageNames || "—")} |`;
    }).join("\n");
    sections.push(`## ${domain}\n\n| # | Problem | Difficulty | Languages |\n|---:|---|---|---|\n${rows}`);
  }

  return `# Algorithm practice\n\n` +
    `Accepted solutions organised by **topic → difficulty → problem**.\n\n` +
    `## Progress\n\n` +
    `| Total | Easy | Medium | Hard |\n` +
    `|---:|---:|---:|---:|\n` +
    `| ${problems.length} | ${stats.Easy} | ${stats.Medium} | ${stats.Hard} |\n\n` +
    `> Generated by SolveLog. Problem statements are not copied; each entry links to its original page.\n\n` +
    `${sections.join("\n\n") || "No solutions have been saved yet."}\n`;
}

export function buildCommitMessage(problem, classification, isNewProblem) {
  const verb = isNewProblem ? "solve" : "update";
  const scope = slugify(classification.primaryDomain).slice(0, 28) || "practice";
  return `${verb}(${scope}): ${problem.frontendId} ${problem.title}`;
}

export function createRecord(problem, classification, path) {
  return {
    platform: problem.platform || "leetcode",
    frontendId: String(problem.frontendId),
    title: problem.title,
    slug: problem.slug,
    difficulty: problem.difficulty,
    primaryDomain: classification.primaryDomain,
    secondaryDomains: classification.secondaryDomains,
    tags: problem.tags || [],
    path,
    url: problem.url,
    languages: {},
    updatedAt: problem.solvedAt
  };
}

export function updateRecordLanguage(record, problem) {
  const key = String(problem.language || "unknown").toLowerCase();
  record.languages = record.languages || {};
  record.languages[key] = {
    label: languageLabel(key),
    filename: solutionFilename(key),
    latestSubmissionId: String(problem.submissionId || "manual"),
    runtime: problem.runtime || "",
    memory: problem.memory || "",
    solvedAt: problem.solvedAt,
    syncSource: problem.syncSource || "accepted",
    context: problem.context || { kind: "practice" }
  };
  record.updatedAt = problem.solvedAt;
  return record;
}

function displayPlatform(value) {
  const text = String(value || "leetcode").toLowerCase();
  if (text === "leetcode") return "LeetCode";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
