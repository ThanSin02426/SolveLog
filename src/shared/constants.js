export const APP_NAME = "SolveLog";
export const INDEX_PATH = ".solvelog/index.json";
export const GENERATED_START = "<!-- SOLVELOG:GENERATED:START -->";
export const GENERATED_END = "<!-- SOLVELOG:GENERATED:END -->";
export const GITHUB_API_VERSION = "2026-03-10";

export const DEFAULT_SETTINGS = Object.freeze({
  syncMode: "github",
  autoSync: true,
  contestSafeMode: true,
  theme: "system",
  palette: "voltage",
  owner: "",
  repo: "",
  branch: "main",
  token: "",
  lastStatus: {
    state: "idle",
    message: "Waiting for an accepted submission.",
    at: null
  },
  stats: {
    total: 0,
    Easy: 0,
    Medium: 0,
    Hard: 0
  },
  pendingSubmissions: [],
  contestVault: [],
  syncQueue: [],
  queueState: {
    busy: false,
    activeQueueId: "",
    activeTitle: "",
    startedAt: null
  },
  syncLease: null,
  seenSubmissionIds: []
});

export const LANGUAGE_EXTENSIONS = Object.freeze({
  bash: "sh",
  c: "c",
  cpp: "cpp",
  csharp: "cs",
  dart: "dart",
  elixir: "ex",
  erlang: "erl",
  golang: "go",
  java: "java",
  javascript: "js",
  javascriptreact: "jsx",
  kotlin: "kt",
  mysql: "sql",
  mssql: "sql",
  oracle: "sql",
  php: "php",
  python: "py",
  python3: "py",
  racket: "rkt",
  ruby: "rb",
  rust: "rs",
  scala: "scala",
  swift: "swift",
  typescript: "ts"
});

export const LANGUAGE_LABELS = Object.freeze({
  bash: "Bash",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  dart: "Dart",
  elixir: "Elixir",
  erlang: "Erlang",
  golang: "Go",
  java: "Java",
  javascript: "JavaScript",
  javascriptreact: "JavaScript",
  kotlin: "Kotlin",
  mysql: "MySQL",
  mssql: "MS SQL Server",
  oracle: "Oracle SQL",
  php: "PHP",
  python: "Python",
  python3: "Python",
  racket: "Racket",
  ruby: "Ruby",
  rust: "Rust",
  scala: "Scala",
  swift: "Swift",
  typescript: "TypeScript"
});
