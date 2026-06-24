import { classifyProblem } from "../shared/classifier.js";
import {
  buildMetadata,
  buildProblemGeneratedBlock,
  createRecord,
  mergeProblemReadme,
  problemDirectory,
  solutionFilename,
  updateRecordLanguage
} from "../shared/generators.js";
import { createZip, bytesToDataUrl } from "./zip.js";
import { normalizeForExport } from "./sync-engine.js";

export async function exportSubmission(rawSubmission) {
  const problem = normalizeForExport(rawSubmission);
  const classification = classifyProblem(problem.tags);
  const path = problemDirectory(problem, classification);
  const record = createRecord(problem, classification, path);
  updateRecordLanguage(record, problem);
  const generated = buildProblemGeneratedBlock(problem, record);

  const zip = createZip([
    { path: `${path}/${solutionFilename(problem.language)}`, content: `${problem.code.trimEnd()}\n` },
    { path: `${path}/metadata.json`, content: buildMetadata(problem, record) },
    { path: `${path}/README.md`, content: `${mergeProblemReadme("", generated).trimEnd()}\n` }
  ]);

  const filename = `solvelog-${String(problem.frontendId).replace(/[^a-zA-Z0-9-]/g, "-")}-${problem.slug}.zip`;
  const downloadId = await chrome.downloads.download({
    url: bytesToDataUrl(zip),
    filename,
    saveAs: false,
    conflictAction: "uniquify"
  });

  return { problem, record, downloadId };
}
