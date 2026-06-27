import { GITHUB_API_VERSION } from "../shared/constants.js";

const API_ROOT = "https://api.github.com";
const GRAPHQL_ROOT = `${API_ROOT}/graphql`;

function encodePath(path) {
  return String(path).split("/").map(encodeURIComponent).join("/");
}

function utf8ToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToUtf8(value) {
  const binary = atob(String(value).replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function payloadText(payload) {
  try {
    return typeof payload === "string" ? payload : JSON.stringify(payload || {});
  } catch {
    return "";
  }
}

function branchMovedError(message = "The branch changed while SolveLog was preparing the commit.") {
  const error = new Error(message);
  error.status = 409;
  error.code = "BRANCH_MOVED";
  return error;
}

export function isEmptyRepositoryError(error) {
  if (!error) return false;
  if (error.code === "EMPTY_REPOSITORY") return true;
  if (error.status !== 409 && error.status !== 422) return false;
  const text = `${error.message || ""} ${payloadText(error.payload)}`.toLowerCase();
  return /git repository is empty|repository is empty|empty repository|repository has no commits/.test(text);
}


export function isNoChangesCommitError(error) {
  if (!error || Number(error.status) !== 422) return false;
  const text = `${error.message || ""} ${payloadText(error.payload)}`.toLowerCase();
  return /no changes|empty commit|nothing to commit|file changes.*empty|changes.*required/.test(text);
}

export function isRepositoryRace(error) {
  if (!error || isEmptyRepositoryError(error)) return false;
  if (error.code === "BRANCH_MOVED") return true;
  if (error.status !== 409 && error.status !== 422) return false;

  const text = `${error.message || ""} ${payloadText(error.payload)}`.toLowerCase();
  if (/protected branch|repository rule|ruleset|required status|signed commit/.test(text)) return false;
  return /fast[- ]?forward|reference update|ref update|branch.+changed|head.+(changed|match|expected)|sha.+match|out of date|conflict/.test(text);
}

export function retryDelay(attempt) {
  const base = Math.min(1800, 180 * (2 ** attempt));
  const jitter = Math.floor(Math.random() * 120);
  return new Promise((resolve) => setTimeout(resolve, base + jitter));
}


function graphQlErrors(payload) {
  return Array.isArray(payload?.errors) ? payload.errors : [];
}

function graphQlMessage(payload) {
  return graphQlErrors(payload)
    .map((item) => String(item?.message || ""))
    .filter(Boolean)
    .join(" | ");
}

function isExpectedHeadMismatch(message) {
  return /expected.*head|head.*oid|does not match.*head|branch.*updated|branch.*changed|out of date/i.test(message);
}

export class GitHubClient {
  constructor({ token, owner, repo, branch }) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
    this.branch = branch || "main";
  }

  get basePath() {
    return `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}`;
  }

  get refPath() {
    return `${this.basePath}/git/ref/heads/${encodeURIComponent(this.branch)}`;
  }

  async request(path, options = {}) {
    const response = await fetch(`${API_ROOT}${path}`, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        ...(options.headers || {})
      }
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = text; }
    }

    if (!response.ok) {
      const message = typeof payload === "object" && payload?.message
        ? payload.message
        : `GitHub returned HTTP ${response.status}.`;
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      error.endpoint = path;
      error.method = options.method || "GET";
      error.requestId = response.headers.get("x-github-request-id") || "";
      throw error;
    }

    return payload;
  }

  async graphql(query, variables) {
    const response = await fetch(GRAPHQL_ROOT, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION
      },
      body: JSON.stringify({ query, variables })
    });

    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = text; }
    }

    if (!response.ok) {
      const error = new Error(
        typeof payload === "object" && payload?.message
          ? payload.message
          : `GitHub returned HTTP ${response.status}.`
      );
      error.status = response.status;
      error.payload = payload;
      error.endpoint = "/graphql";
      error.method = "POST";
      error.requestId = response.headers.get("x-github-request-id") || "";
      throw error;
    }

    const message = graphQlMessage(payload);
    if (message) {
      if (isExpectedHeadMismatch(message)) throw branchMovedError(message);
      const error = new Error(message);
      error.status = 422;
      error.payload = payload;
      error.endpoint = "/graphql";
      error.method = "POST";
      error.requestId = response.headers.get("x-github-request-id") || "";
      throw error;
    }

    return payload?.data || null;
  }

  async repository() {
    return this.request(this.basePath);
  }

  async verify() {
    const repo = await this.repository();
    return {
      fullName: repo.full_name,
      private: repo.private,
      defaultBranch: repo.default_branch,
      permissions: repo.permissions || null
    };
  }

  async getHead() {
    try {
      const ref = await this.request(this.refPath);
      return { sha: ref.object.sha };
    } catch (error) {
      // GitHub returns HTTP 409 (not 404) when a repository exists but has
      // no commits yet. Mark it explicitly so it is never mistaken for a
      // concurrent branch update.
      if (isEmptyRepositoryError(error)) error.code = "EMPTY_REPOSITORY";
      throw error;
    }
  }

  async getFile(path, ref = this.branch) {
    try {
      const file = await this.request(
        `${this.basePath}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`
      );
      if (Array.isArray(file) || file.type !== "file") return null;
      return {
        path: file.path,
        sha: file.sha,
        text: base64ToUtf8(file.content)
      };
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  async initializeIfEmpty(initialReadme) {
    try {
      await this.getHead();
      return { initialized: false };
    } catch (error) {
      if (error.status !== 404 && !isEmptyRepositoryError(error)) throw error;
    }

    const createReadme = async (includeBranch) => {
      const body = {
        message: "chore: initialise SolveLog repository",
        content: utf8ToBase64(initialReadme)
      };
      if (includeBranch && this.branch) body.branch = this.branch;
      return this.request(`${this.basePath}/contents/README.md`, {
        method: "PUT",
        body: JSON.stringify(body)
      });
    };

    try {
      // Supplying the desired branch normally creates the initial branch.
      await createReadme(true);
    } catch (firstError) {
      const text = `${firstError.message || ""} ${payloadText(firstError.payload)}`.toLowerCase();
      const branchRejected = firstError.status === 422 && /branch|reference|ref/.test(text);

      if (branchRejected) {
        // Some empty repositories only accept the account's configured default
        // branch for the very first commit. Retry without an explicit branch.
        try {
          await createReadme(false);
        } catch (secondError) {
          try {
            await this.getHead();
            return { initialized: true };
          } catch {
            throw secondError;
          }
        }
      } else if (firstError.status === 409 || firstError.status === 422) {
        // Another extension instance may have initialised it between our GET
        // and PUT. Confirm that a branch now exists before treating it as a
        // failure.
        try {
          await this.getHead();
          return { initialized: true };
        } catch {
          throw firstError;
        }
      } else {
        throw firstError;
      }
    }

    // GitHub may take a moment to expose the first branch through the Git refs
    // endpoint. Poll briefly instead of misreporting it as a branch conflict.
    let lastError = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        await this.getHead();
        return { initialized: true };
      } catch (error) {
        lastError = error;
        if (error.status !== 404 && !isEmptyRepositoryError(error)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 150 + (attempt * 100)));
      }
    }

    const error = new Error(
      "GitHub accepted the initial README, but the branch is not available yet. Wait a few seconds and retry."
    );
    error.status = lastError?.status || 409;
    error.code = "INITIALIZATION_PENDING";
    error.payload = lastError?.payload || null;
    throw error;
  }

  async commitFilesAtHead(files, message, head) {
    if (!head?.sha) throw new Error("A repository snapshot is required.");

    const seenPaths = new Set();
    const additions = files.map((file) => {
      const path = String(file.path || "").replace(/^\/+/, "");
      if (!path || seenPaths.has(path)) {
        throw new Error(`Invalid or duplicate repository path: ${path || "(empty)"}`);
      }
      seenPaths.add(path);
      return {
        path,
        contents: utf8ToBase64(String(file.content ?? ""))
      };
    });

    // GitHub's createCommitOnBranch mutation creates the commit and advances
    // the branch in one server-side operation. expectedHeadOid provides the
    // optimistic concurrency check without the REST tree/commit/ref race window.
    const mutation = `
      mutation SolveLogCommit($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
          commit { oid url }
          ref { name }
        }
      }
    `;

    const data = await this.graphql(mutation, {
      input: {
        branch: {
          repositoryNameWithOwner: `${this.owner}/${this.repo}`,
          branchName: this.branch
        },
        expectedHeadOid: head.sha,
        message: { headline: String(message).slice(0, 240) },
        fileChanges: { additions },
        clientMutationId: typeof globalThis.crypto?.randomUUID === "function"
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`
      }
    });

    const commit = data?.createCommitOnBranch?.commit;
    if (!commit?.oid) throw new Error("GitHub did not return the created commit.");
    return { sha: commit.oid, url: commit.url || "" };
  }
}
