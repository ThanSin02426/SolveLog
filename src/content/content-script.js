(() => {
  const channel = crypto.randomUUID();
  const pendingEditorRequests = new Map();
  const fallbackInFlight = new Set();
  const fallbackCompleted = new Set();
  const announcedContests = new Set();
  let lastToastTimer = null;
  let fallbackTimer = null;
  let lastObservedLocation = `${location.pathname}${location.search}`;

  injectPageHook();
  installAcceptedPageFallback();
  announceContestSafeMode().catch(() => undefined);

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (message?.source !== "solvelog-page" || message?.channel !== channel) return;

    if (message.type === "ACCEPTED") {
      handleAccepted(message.payload).catch((error) => showToast(error.message, "error"));
    }

    if (message.type === "EDITOR") {
      const pending = pendingEditorRequests.get(message.payload?.requestId);
      if (pending) {
        pendingEditorRequests.delete(message.payload.requestId);
        pending.resolve(message.payload);
      }
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "MANUAL_SYNC") return false;
    manualSync()
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  });

  function injectPageHook() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("src/page/page-hook.js");
    script.dataset.solvelogChannel = channel;
    script.async = false;
    script.addEventListener("load", () => script.remove(), { once: true });
    script.addEventListener("error", () => {
      console.warn("SolveLog: page hook could not be loaded.");
      script.remove();
    }, { once: true });

    const mount = () => {
      const parent = document.head || document.documentElement;
      if (parent) parent.appendChild(script);
      else requestAnimationFrame(mount);
    };
    mount();
  }

  async function handleAccepted(payload) {
    const route = currentProblemRoute();
    const slug = payload.slug || route.slug;
    const metadata = await fetchProblemMetadata(slug);
    const submission = makeSubmission(metadata, payload, "accepted");
    showToast(`Accepted · processing ${metadata.title}`, "working");
    const response = await chrome.runtime.sendMessage({ type: "SUBMISSION_ACCEPTED", submission });
    if (!response?.ok) throw new Error(response?.error || "SolveLog could not save this submission.");

    if (response.skipped) showToast(response.reason, "neutral");
    else if (response.vaulted) showToast("Saved locally · Contest Vault", "vault");
    else if (response.duplicate || response.result?.duplicate) showToast("Already saved", "neutral");
    else if (response.queued) showToast(response.position > 1 ? `Queued · ${response.position - 1} ahead` : "Queued for saving", "neutral");
    else showToast(response.exported ? "Solution downloaded" : "Committed to GitHub", "success");
    return response;
  }

  async function manualSync() {
    const editor = await requestEditor();
    if (!editor.code?.trim()) throw new Error("No code was found in the editor.");
    const route = currentProblemRoute();
    if (!route.slug) throw new Error("Open a LeetCode problem before saving.");
    const metadata = await fetchProblemMetadata(route.slug);
    const submissionRoute = currentSubmissionRoute();
    const metrics = readSubmissionMetrics();
    const submission = makeSubmission(metadata, {
      ...editor,
      submissionId: submissionRoute?.submissionId || "manual",
      solvedAt: new Date().toISOString(),
      runtime: metrics.runtime,
      memory: metrics.memory
    }, "manual");
    const response = await chrome.runtime.sendMessage({ type: "SUBMISSION_ACCEPTED", submission });
    if (!response?.ok) throw new Error(response?.error || "Manual sync failed.");
    if (response.vaulted) showToast("Saved locally · Contest Vault", "vault");
    else if (response.queued) showToast(response.position > 1 ? `Queued · ${response.position - 1} ahead` : "Queued for saving", "neutral");
    else showToast(response.exported ? "Solution downloaded" : "Current code saved", "success");
    return response;
  }

  function requestEditor(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const timeout = setTimeout(() => {
        pendingEditorRequests.delete(requestId);
        reject(new Error("Could not read the LeetCode editor. Wait for the code panel to load and try again."));
      }, timeoutMs);
      pendingEditorRequests.set(requestId, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        }
      });
      window.postMessage({ source: "solvelog-content", channel, type: "GET_EDITOR", requestId }, "*");
    });
  }

  function currentProblemRoute() {
    const contestMatch = location.pathname.match(/^\/contest\/([^/]+)\/problems\/([^/]+)/);
    if (contestMatch) {
      return {
        slug: contestMatch[2],
        context: contestContext(contestMatch[1])
      };
    }

    const anyContestMatch = location.pathname.match(/^\/contest\/([^/]+)/);
    if (anyContestMatch) {
      return {
        slug: slugFromCanonical(),
        context: contestContext(anyContestMatch[1])
      };
    }

    const problemMatch = location.pathname.match(/^\/problems\/([^/]+)/);
    const params = new URLSearchParams(location.search);
    if (problemMatch && params.get("envType") === "contest") {
      return {
        slug: problemMatch[1],
        context: contestContext(params.get("envId") || "contest")
      };
    }

    return {
      slug: problemMatch?.[1] || slugFromCanonical(),
      context: { kind: "practice", contestId: "", contestTitle: "", contestUrl: "" }
    };
  }

  function currentSubmissionRoute() {
    const regular = location.pathname.match(/^\/problems\/([^/]+)\/submissions\/(\d+)\/?/);
    if (regular) return { slug: regular[1], submissionId: regular[2] };

    const contestDetail = location.pathname.match(/^\/contest\/([^/]+)\/submissions\/(?:detail\/)?(\d+)\/?/);
    if (contestDetail) {
      return {
        slug: currentProblemRoute().slug,
        submissionId: contestDetail[2],
        context: contestContext(contestDetail[1])
      };
    }

    const genericId = location.pathname.match(/\/submissions\/(?:detail\/)?(\d+)\/?/);
    return genericId ? { slug: currentProblemRoute().slug, submissionId: genericId[1] } : null;
  }

  function contestContext(contestId) {
    const safeId = String(contestId || "contest");
    return {
      kind: "contest",
      contestId: safeId,
      contestTitle: safeId.split("-").filter(Boolean).map(capitalise).join(" ") || "LeetCode Contest",
      contestUrl: `https://leetcode.com/contest/${encodeURIComponent(safeId)}/`
    };
  }

  function slugFromCanonical() {
    const canonical = document.querySelector('link[rel="canonical"]')?.href || "";
    try {
      return new URL(canonical).pathname.match(/\/problems\/([^/]+)/)?.[1] || "";
    } catch {
      return "";
    }
  }

  function installAcceptedPageFallback() {
    const schedule = (delay = 350) => {
      clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(() => {
        scanAcceptedSubmissionPage().catch((error) => {
          console.warn("SolveLog fallback detection failed:", error);
        });
      }, delay);
    };

    const observer = new MutationObserver(() => schedule());
    const observe = () => {
      if (!document.documentElement) {
        requestAnimationFrame(observe);
        return;
      }
      observer.observe(document.documentElement, { childList: true, subtree: true });
      schedule(0);
    };
    observe();

    window.addEventListener("pageshow", () => schedule(0));
    window.addEventListener("popstate", () => schedule(0));

    setInterval(() => {
      const current = `${location.pathname}${location.search}`;
      if (current !== lastObservedLocation) {
        lastObservedLocation = current;
        schedule(0);
        announceContestSafeMode().catch(() => undefined);
      }
    }, 800);
  }

  async function scanAcceptedSubmissionPage() {
    const route = currentSubmissionRoute();
    if (!route?.submissionId || !route.slug) return;
    if (fallbackCompleted.has(route.submissionId) || fallbackInFlight.has(route.submissionId)) return;
    if (!pageShowsAcceptedResult()) return;

    fallbackInFlight.add(route.submissionId);
    try {
      const editor = await waitForEditor();
      if (!editor.code?.trim()) return;
      const metrics = readSubmissionMetrics();
      await handleAccepted({
        slug: route.slug,
        submissionId: route.submissionId,
        status: "Accepted",
        code: editor.code,
        language: editor.language,
        runtime: metrics.runtime,
        memory: metrics.memory,
        solvedAt: new Date().toISOString(),
        context: route.context
      });
      fallbackCompleted.add(route.submissionId);
    } finally {
      fallbackInFlight.delete(route.submissionId);
    }
  }

  async function waitForEditor() {
    let lastError;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const editor = await requestEditor(2500);
        if (editor.code?.trim()) return editor;
      } catch (error) {
        lastError = error;
      }
      await delay(700);
    }
    throw lastError || new Error("The submitted code has not loaded yet.");
  }

  function pageShowsAcceptedResult() {
    const text = document.body?.innerText || "";
    const hasAccepted = /(^|\n)\s*Accepted\s*(\n|$)/i.test(text);
    const hasSubmissionEvidence = /\d+\s*\/\s*\d+\s*testcases passed/i.test(text)
      || /\bRuntime\b[\s\S]{0,80}\bMemory\b/i.test(text);
    return hasAccepted && hasSubmissionEvidence;
  }

  function readSubmissionMetrics() {
    const text = document.body?.innerText || "";
    const runtime = text.match(/\bRuntime\s*\n?\s*([\d.]+\s*(?:ns|µs|us|ms|s))\b/i)?.[1] || "";
    const memory = text.match(/\bMemory\s*\n?\s*([\d.]+\s*(?:B|KB|MB|GB))\b/i)?.[1] || "";
    return { runtime, memory };
  }

  async function fetchProblemMetadata(slug) {
    if (!slug) throw new Error("Open a LeetCode problem before syncing.");
    const query = `query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        questionFrontendId
        title
        titleSlug
        difficulty
        topicTags { name slug }
      }
    }`;

    try {
      const response = await fetch("https://leetcode.com/graphql/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { titleSlug: slug }, operationName: "questionData" })
      });
      if (!response.ok) throw new Error(`LeetCode returned ${response.status}.`);
      const payload = await response.json();
      const question = payload?.data?.question;
      if (!question) throw new Error("Problem metadata was unavailable.");
      return {
        id: question.questionFrontendId || question.questionId,
        title: question.title,
        slug: question.titleSlug || slug,
        difficulty: question.difficulty,
        tags: (question.topicTags || []).map((tag) => tag.name),
        url: `https://leetcode.com/problems/${question.titleSlug || slug}/`
      };
    } catch {
      return metadataFromPage(slug);
    }
  }

  function metadataFromPage(slug) {
    const rawTitle = document.querySelector('meta[property="og:title"]')?.content || document.title || slug;
    const title = rawTitle.replace(/\s*-\s*LeetCode.*$/i, "").replace(/^\d+\.\s*/, "").trim();
    const idMatch = rawTitle.match(/^(\d+)\./) || document.body?.innerText?.match(/\b(\d+)\.\s+[^\n]+/);
    const difficulty = ["Easy", "Medium", "Hard"].find((value) =>
      [...document.querySelectorAll("div, span")].some((node) => node.textContent?.trim() === value)
    ) || "Unknown";
    return {
      id: idMatch?.[1] || slug,
      title: title || slug,
      slug,
      difficulty,
      tags: [],
      url: `https://leetcode.com/problems/${slug}/`
    };
  }

  function makeSubmission(metadata, payload, syncSource) {
    const solvedAt = payload.solvedAt || new Date().toISOString();
    return {
      schemaVersion: 2,
      platform: "leetcode",
      platformSubmissionId: payload.submissionId || "manual",
      problem: metadata,
      solution: {
        language: payload.language,
        code: payload.code,
        runtime: payload.runtime || "",
        memory: payload.memory || ""
      },
      context: payload.context || currentProblemRoute().context,
      solvedAt,
      capturedAt: solvedAt,
      syncSource
    };
  }

  async function announceContestSafeMode() {
    const context = currentProblemRoute().context;
    if (context.kind !== "contest" || announcedContests.has(context.contestId)) return;
    const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
    if (!response?.ok || response.settings?.contestSafeMode === false) return;
    announcedContests.add(context.contestId);
    showToast("Contest Safe Mode · commits are paused", "vault", 5200);
  }

  function showToast(message, type = "neutral", duration = 3600) {
    const existing = document.getElementById("solvelog-toast");
    if (existing) existing.remove();
    clearTimeout(lastToastTimer);

    const toast = document.createElement("div");
    toast.id = "solvelog-toast";
    toast.textContent = `SolveLog · ${message}`;
    const palette = {
      success: ["#00c95b", "#111"],
      error: ["#ff4f55", "#111"],
      working: ["#2f7cff", "#fff"],
      vault: ["#ffd600", "#111"],
      neutral: ["#171717", "#fff"]
    }[type] || ["#171717", "#fff"];
    Object.assign(toast.style, {
      position: "fixed",
      zIndex: "2147483647",
      right: "18px",
      bottom: "18px",
      maxWidth: "390px",
      padding: "13px 16px",
      border: "3px solid #111",
      borderRadius: "0",
      background: palette[0],
      color: palette[1],
      boxShadow: "5px 5px 0 #111",
      font: "800 13px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    });
    (document.body || document.documentElement).appendChild(toast);
    lastToastTimer = setTimeout(() => toast.remove(), duration);
  }

  function capitalise(value) {
    const text = String(value || "");
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();
