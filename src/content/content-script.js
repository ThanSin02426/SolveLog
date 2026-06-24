(() => {
  const channel = crypto.randomUUID();
  const pendingEditorRequests = new Map();
  const fallbackInFlight = new Set();
  const fallbackCompleted = new Set();
  let lastToastTimer = null;
  let fallbackTimer = null;
  let lastObservedPath = location.pathname;

  injectPageHook();
  installAcceptedPageFallback();

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
    const metadata = await fetchProblemMetadata(payload.slug || currentSlug());
    const submission = makeSubmission(metadata, payload, "accepted");
    showToast(`Accepted · saving ${metadata.title}`, "working");
    const response = await chrome.runtime.sendMessage({ type: "SUBMISSION_ACCEPTED", submission });
    if (!response?.ok) throw new Error(response?.error || "SolveLog could not save this submission.");
    if (response.skipped) showToast(response.reason, "neutral");
    else if (response.duplicate || response.result?.duplicate) showToast("Already saved", "neutral");
    else if (response.queued) showToast(response.position > 1 ? `Queued · ${response.position - 1} ahead` : "Queued for saving", "neutral");
    else showToast(response.exported ? "Solution downloaded" : "Committed to GitHub", "success");
    return response;
  }

  async function manualSync() {
    const editor = await requestEditor();
    if (!editor.code?.trim()) throw new Error("No code was found in the editor.");
    const slug = currentSlug();
    const metadata = await fetchProblemMetadata(slug);
    const route = currentSubmissionRoute();
    const metrics = readSubmissionMetrics();
    const submission = makeSubmission(metadata, {
      ...editor,
      submissionId: route?.submissionId || "manual",
      solvedAt: new Date().toISOString(),
      runtime: metrics.runtime,
      memory: metrics.memory
    }, "manual");
    const response = await chrome.runtime.sendMessage({ type: "SUBMISSION_ACCEPTED", submission });
    if (!response?.ok) throw new Error(response?.error || "Manual sync failed.");
    if (response.queued) showToast(response.position > 1 ? `Queued · ${response.position - 1} ahead` : "Queued for saving", "neutral");
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

  function currentSlug() {
    return location.pathname.match(/^\/problems\/([^/]+)/)?.[1] || "";
  }

  function currentSubmissionRoute() {
    const match = location.pathname.match(/^\/problems\/([^/]+)\/submissions\/(\d+)\/?/);
    if (!match) return null;
    return { slug: match[1], submissionId: match[2] };
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
      if (location.pathname !== lastObservedPath) {
        lastObservedPath = location.pathname;
        schedule(0);
      }
    }, 800);
  }

  async function scanAcceptedSubmissionPage() {
    const route = currentSubmissionRoute();
    if (!route) return;
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
        solvedAt: new Date().toISOString()
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
        frontendId: question.questionFrontendId || question.questionId,
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
      frontendId: idMatch?.[1] || slug,
      title: title || slug,
      slug,
      difficulty,
      tags: [],
      url: `https://leetcode.com/problems/${slug}/`
    };
  }

  function makeSubmission(metadata, payload, syncSource) {
    return {
      ...metadata,
      language: payload.language,
      code: payload.code,
      runtime: payload.runtime || "",
      memory: payload.memory || "",
      submissionId: payload.submissionId || "manual",
      solvedAt: payload.solvedAt || new Date().toISOString(),
      syncSource
    };
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function showToast(message, state) {
    clearTimeout(lastToastTimer);
    let toast = document.getElementById("solvelog-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "solvelog-toast";
      Object.assign(toast.style, {
        position: "fixed",
        right: "20px",
        bottom: "20px",
        zIndex: "2147483647",
        maxWidth: "320px",
        padding: "11px 14px",
        borderRadius: "0",
        font: "800 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace",
        color: "#111",
        background: "#ffd600",
        border: "3px solid #111",
        boxShadow: "5px 5px 0 #111",
        opacity: "0",
        transform: "translateY(8px)",
        transition: "opacity .16s ease, transform .16s ease"
      });
      document.documentElement.appendChild(toast);
    }
    toast.textContent = `SolveLog · ${message}`;
    toast.style.background = state === "error" ? "#ff5151" : state === "success" ? "#16d96b" : state === "working" ? "#3478f6" : "#ffd600";
    toast.style.color = state === "working" ? "#fff" : "#111";
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });
    lastToastTimer = setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
    }, state === "error" ? 6000 : 3200);
  }
})();
