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
]);

export function titleTokens(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(" ")
      .filter((t) => t.length >= 4 && !STOP.has(t)),
  );
}

/** Jaccard / containment — true if looks like the same story. */
export function isSimilarTitle(a: string, b: string, threshold = 0.5): boolean {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  if (union > 0 && inter / union >= threshold) return true;
  const smaller = Math.min(ta.size, tb.size);
  if (smaller >= 3 && inter / smaller >= 0.8) return true;
  return false;
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
