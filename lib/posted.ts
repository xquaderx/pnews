import { createHash } from "node:crypto";

/** Strip tracking params / fragments so the same article hashes once. */
export function canonicalizeLink(link: string): string {
  try {
    const url = new URL(link);
    url.hash = "";
    const drop = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "at_medium",
      "at_campaign",
      "fbclid",
      "gclid",
      "mc_cid",
      "mc_eid",
    ];
    for (const key of drop) url.searchParams.delete(key);
    // Stable host + path + remaining query
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    let path = url.pathname.replace(/\/+$/, "");
    if (!path) path = "/";
    const q = url.searchParams.toString();
    return `${url.protocol}//${url.hostname}${path}${q ? `?${q}` : ""}`;
  } catch {
    return link.trim();
  }
}

export function postedKey(link: string): string {
  const hash = createHash("sha256")
    .update(canonicalizeLink(link))
    .digest("hex")
    .slice(0, 24);
  return `posted:${hash}`;
}

export function titleKey(title: string): string {
  const norm = normalizeTitle(title);
  const hash = createHash("sha256").update(norm).digest("hex").slice(0, 24);
  return `posted-title:${hash}`;
}

/** Coarse story fingerprint — catches cross-source rewrites of the same event. */
export function storyKey(title: string): string {
  const tokens = [...titleTokens(title)].sort().slice(0, 6);
  const hash = createHash("sha256").update(tokens.join("|")).digest("hex").slice(0, 24);
  return `posted-story:${hash}`;
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set([
  "para",
  "com",
  "uma",
  "por",
  "dos",
  "das",
  "pelo",
  "pela",
  "que",
  "nao",
  "mais",
  "como",
  "apos",
  "sobre",
  "entre",
  "este",
  "esta",
  "isso",
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "after",
  "about",
  "into",
  "will",
  "have",
  "been",
  "were",
  "says",
  "said",
  "over",
  "under",
  "amid",
  "near",
  "against",
  "could",
  "would",
  "should",
  "their",
  "there",
  "where",
  "which",
  "while",
  "before",
  "update",
  "updates",
  "live",
  "breaking",
  "report",
  "reports",
  "что",
  "это",
  "как",
  "для",
  "при",
  "или",
  "после",
  "перед",
  "когда",
  "только",
  "также",
  "будет",
  "были",
  "этот",
  "эта",
  "эти",
  "своей",
  "своего",
  "обновления",
  "новости",
]);

export function titleTokens(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(" ")
      .filter((t) => t.length >= 4 && !STOP.has(t)),
  );
}

/** Jaccard / containment — true if looks like the same story. */
export function isSimilarTitle(a: string, b: string, threshold = 0.42): boolean {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  if (union > 0 && inter / union >= threshold) return true;
  const smaller = Math.min(ta.size, tb.size);
  // Same proper-noun core across outlets (e.g. Pike / Paxton / Cuellar stories).
  if (smaller >= 3 && inter / smaller >= 0.72) return true;
  if (smaller >= 4 && inter >= 3) return true;
  // Same named subject + same topic, even when outlets rewrite the angle.
  const longShared = [...ta].filter((t) => tb.has(t) && t.length >= 4);
  if (longShared.length >= 2) {
    const topic =
      /\b(execut|inject|hurricane|storm|indict|impeach|pardon|rally|debate|midterm|казни|инъекц|ураган|шторм|митинг|помилов|сенат|выбор)/i;
    if (topic.test(a) && topic.test(b)) return true;
  }
  return false;
}

/**
 * Collapse cross-outlet rewrites of the same story inside one fetch.
 * Keeps the freshest item; prefers already-trusted national desks.
 */
export function collapseSimilarItems<T extends { title: string; publishedAt: string | null; source: string }>(
  items: T[],
): T[] {
  const kept: T[] = [];
  for (const item of items) {
    const idx = kept.findIndex((k) => isSimilarTitle(k.title, item.title));
    if (idx < 0) {
      kept.push(item);
      continue;
    }
    const prev = kept[idx]!;
    const newer =
      publishedMs(item.publishedAt) > publishedMs(prev.publishedAt)
        ? item
        : prev;
    // If timestamps tie / close, prefer the one already in kept unless new is clearly newer.
    kept[idx] = newer === item ? item : prev;
  }
  return kept;
}

function publishedMs(publishedAt: string | null): number {
  if (!publishedAt) return 0;
  const ts = Date.parse(publishedAt);
  return Number.isNaN(ts) ? 0 : ts;
}

export const RECENT_TITLES_KEY = "posted:recent-titles";

export type PostedRecord = {
  link: string;
  title: string;
  postedAt: string;
  messageId?: number;
};

export type RecentTitles = {
  titles: string[];
};
