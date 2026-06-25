(() => {
  if (window.__SOLVELOG_PAGE_HOOK__) return;
  window.__SOLVELOG_PAGE_HOOK__ = true;

  const script = document.currentScript;
  const channel = script?.dataset?.solvelogChannel || "";
  const SOURCE = "solvelog-page";
  const REQUEST_SOURCE = "solvelog-content";
  let lastSubmission = readLastSubmission();
  const emitted = new Set();

  function post(type, payload = {}) {
    window.postMessage({ source: SOURCE, channel, type, payload }, "*");
  }

  function readLastSubmission() {
    try {
      return JSON.parse(sessionStorage.getItem("solvelog:last-submission") || "null");
    } catch {
      return null;
    }
  }

  function writeLastSubmission(value) {
    lastSubmission = value;
    try { sessionStorage.setItem("solvelog:last-submission", JSON.stringify(value)); } catch {}
  }

  function parseBody(body) {
    if (!body) return null;
    try {
      if (typeof body === "string") return JSON.parse(body);
      if (body instanceof URLSearchParams) return Object.fromEntries(body.entries());
    } catch {}
    return null;
  }

  function isSubmissionRequest(url) {
    return /\/problems\/[^/]+\/submit\/?(?:\?|$)/.test(url)
      || /\/contest\/[^/]+\/problems\/[^/]+\/submit\/?(?:\?|$)/.test(url);
  }

  function currentSlug() {
    return location.pathname.match(/^\/contest\/[^/]+\/problems\/([^/]+)/)?.[1]
      || location.pathname.match(/^\/problems\/([^/]+)/)?.[1]
      || canonicalSlug();
  }

  function canonicalSlug() {
    const href = document.querySelector('link[rel="canonical"]')?.href || "";
    try { return new URL(href).pathname.match(/\/problems\/([^/]+)/)?.[1] || ""; } catch { return ""; }
  }

  function captureRequest(url, body) {
    if (!isSubmissionRequest(url)) return;
    const parsed = parseBody(body);
    if (!parsed?.typed_code || !parsed?.lang) return;
    writeLastSubmission({
      slug: currentSlug(),
      code: parsed.typed_code,
      language: parsed.lang,
      questionId: String(parsed.question_id || ""),
      capturedAt: new Date().toISOString()
    });
  }

  function captureResponse(url, data) {
    if (!data || typeof data !== "object") return;

    if (isSubmissionRequest(url) && data.submission_id && lastSubmission) {
      writeLastSubmission({ ...lastSubmission, submissionId: String(data.submission_id) });
      return;
    }

    const checkMatch = url.match(/\/submissions\/detail\/(\d+)\/check\/?/);
    if (!checkMatch) return;
    const submissionId = String(data.submission_id || checkMatch[1]);
    const status = String(data.status_msg || data.status || "");
    if (status.toLowerCase() !== "accepted" || emitted.has(submissionId)) return;

    const snapshot = lastSubmission || readLastSubmission();
    if (!snapshot?.code || !snapshot?.language) return;
    if (snapshot.submissionId && String(snapshot.submissionId) !== submissionId) return;

    emitted.add(submissionId);
    post("ACCEPTED", {
      ...snapshot,
      slug: snapshot.slug || currentSlug(),
      submissionId,
      status: "Accepted",
      runtime: data.status_runtime || data.runtime || "",
      memory: data.status_memory || data.memory || "",
      totalCorrect: data.total_correct ?? null,
      totalTestcases: data.total_testcases ?? null,
      solvedAt: new Date().toISOString()
    });
  }

  function inspectJsonResponse(url, response) {
    response.clone().json().then((data) => captureResponse(url, data)).catch(() => undefined);
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function patchedFetch(input, init = {}) {
    const url = typeof input === "string" ? input : input?.url || "";
    captureRequest(url, init?.body);
    const response = await originalFetch(input, init);
    inspectJsonResponse(url, response);
    return response;
  };

  const OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = class SolveLogXHR extends OriginalXHR {
    open(method, url, ...rest) {
      this.__solvelogUrl = String(url || "");
      return super.open(method, url, ...rest);
    }

    send(body) {
      captureRequest(this.__solvelogUrl || "", body);
      this.addEventListener("load", () => {
        try { captureResponse(this.__solvelogUrl || "", JSON.parse(this.responseText)); } catch {}
      }, { once: true });
      return super.send(body);
    }
  };

  function editorState() {
    try {
      const models = window.monaco?.editor?.getModels?.() || [];
      const model = models.find((item) => item.getValue?.().trim()) || models[0];
      const code = model?.getValue?.() || lastSubmission?.code || "";
      const language = lastSubmission?.language || model?.getLanguageId?.() || "";
      return { code, language };
    } catch {
      return { code: lastSubmission?.code || "", language: lastSubmission?.language || "" };
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (message?.source !== REQUEST_SOURCE || message?.channel !== channel) return;
    if (message.type === "GET_EDITOR") {
      post("EDITOR", { requestId: message.requestId, ...editorState() });
    }
  });
})();
