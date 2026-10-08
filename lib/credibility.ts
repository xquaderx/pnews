export type CredibilityResult = {
  ok: boolean;
  score: number;
  reasons: string[];
  sourceTier: "trusted" | "unknown" | "blocked";
};

const TRUSTED_SOURCES = new Set([
  "the hill",
  "npr",
  "npr business",
  "npr science",
  "nyt politics",
  "nyt business",
  "nyt technology",
  "cbs politics",
  "cbs us",
  "abc politics",
  "bbc us & canada",
  "bbc russian",
  "bbc business",
  "cnbc",
  "techcrunch",
  "nhc atlantic",
  "associated press",
  "reuters",
]);

const BLOCKED_HOST_HINTS = [
  "whatsapp",
  "t.me/",
  "bit.ly",
  "tinyurl",
  "blogspot",
  "wordpress.com",
];

const LOW_INFO_PATTERNS = [
  /^\s*videos?\s*:/i,
  /\bwatch\s+(live|now)\b/i,
  /\blive\s+updates?\b/i,
  /\bnewsletter\b/i,
  /\bsubscribe\b/i,
  /\bpodcast\b/i,
  /\bquiz\b/i,
  /\bhoroscope\b/i,
  /\bcrossword\b/i,
  /\bour\s+picks\b/i,
  /\bwhat\s+to\s+watch\b/i,
];

export function assessCredibility(input: {
  title: string;
  summary: string;
  source: string;
  articleLink: string;
}): CredibilityResult {
  const reasons: string[] = [];
  let score = 50;
  const sourceNorm = input.source.trim().toLowerCase();
  const blob = `${input.title}\n${input.summary}`;
  const link = input.articleLink.toLowerCase();

  if (TRUSTED_SOURCES.has(sourceNorm)) {
    score += 25;
    reasons.push("trusted_source");
  } else {
    reasons.push("unknown_source");
  }

  for (const hint of BLOCKED_HOST_HINTS) {
    if (link.includes(hint)) {
      return {
        ok: false,
        score: 0,
        reasons: ["blocked_host"],
        sourceTier: "blocked",
      };
    }
  }

  for (const re of LOW_INFO_PATTERNS) {
    if (re.test(blob)) {
      return {
        ok: false,
        score: 0,
        reasons: ["low_info"],
        sourceTier: "blocked",
      };
    }
  }

  if (input.title.length < 18) {
    return {
      ok: false,
      score: 0,
      reasons: ["title_too_short"],
      sourceTier: "unknown",
    };
  }

  if (/(.)\1{6,}/.test(blob)) {
    return {
      ok: false,
      score: 0,
      reasons: ["spam_chars"],
      sourceTier: "blocked",
    };
  }

  const tier = TRUSTED_SOURCES.has(sourceNorm) ? "trusted" : "unknown";
  return {
    ok: score >= 40,
    score,
    reasons,
    sourceTier: tier,
  };
}
