const DOMAIN_RULES = [
  ["Dynamic-Programming", ["dynamic programming", "memoization"]],
  ["Graphs", ["graph", "shortest path", "topological sort", "union find", "minimum spanning tree", "biconnected component", "eulerian circuit"]],
  ["Trees", ["tree", "binary tree", "binary search tree", "segment tree", "fenwick tree"]],
  ["Tries", ["trie", "suffix array"]],
  ["Backtracking", ["backtracking"]],
  ["Greedy", ["greedy"]],
  ["Heaps", ["heap (priority queue)", "priority queue"]],
  ["Binary-Search", ["binary search"]],
  ["Sliding-Window", ["sliding window"]],
  ["Two-Pointers", ["two pointers"]],
  ["Intervals", ["intervals", "line sweep"]],
  ["Stacks-and-Queues", ["stack", "queue", "monotonic stack", "monotonic queue"]],
  ["Linked-Lists", ["linked list", "doubly-linked list"]],
  ["Sorting", ["sorting", "merge sort", "quickselect", "bucket sort", "radix sort", "counting sort"]],
  ["Hashing", ["hash table", "hash function", "rolling hash"]],
  ["Matrix", ["matrix"]],
  ["Strings", ["string", "string matching"]],
  ["Arrays", ["array", "prefix sum", "difference array"]],
  ["Bit-Manipulation", ["bit manipulation", "bitmask"]],
  ["Math", ["math", "geometry", "number theory", "combinatorics", "probability and statistics", "game theory"]],
  ["Design", ["design", "data stream", "iterator"]],
  ["Database", ["database"]],
  ["Concurrency", ["concurrency"]],
  ["Simulation", ["simulation"]]
];

const TRAVERSAL_TAGS = new Set(["depth-first search", "breadth-first search"]);

export function classifyProblem(tags = []) {
  const normalized = [...new Set(tags.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];

  // DFS/BFS describe a technique, not necessarily a graph. Tree tags win first.
  const hasTree = normalized.some((tag) => tag.includes("tree"));
  const searchable = hasTree
    ? normalized.filter((tag) => !TRAVERSAL_TAGS.has(tag))
    : normalized.map((tag) => (TRAVERSAL_TAGS.has(tag) ? "graph" : tag));

  const matches = [];
  for (const [domain, terms] of DOMAIN_RULES) {
    if (terms.some((term) => searchable.includes(term))) matches.push(domain);
  }

  return {
    primaryDomain: matches[0] || "Other",
    secondaryDomains: matches.slice(1)
  };
}
