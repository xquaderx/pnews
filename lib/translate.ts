import type { SimpleKv } from "./file-kv.js";
import { createHash } from "node:crypto";

function cacheKey(text: string): string {
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 24);
  return `tr:en-ru:${hash}`;
}

/** Free EN→RU via MyMemory; cached in file kv. Falls back to original on failure. */
export async function translateToRu(
  kv: SimpleKv,
  text: string,
): Promise<string> {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (looksMostlyCyrillic(cleaned)) return cleaned;

  const key = cacheKey(cleaned);
  const cached = await kv.get(key);
  if (typeof cached === "string" && cached.length > 0) return cached;

  // MyMemory free tier ~500 bytes/query; chunk long text.
  const chunks = chunkText(cleaned, 420);
  const out: string[] = [];
  for (const chunk of chunks) {
    const translated = await mymemory(chunk);
    out.push(translated ?? chunk);
    await sleep(350);
  }
  const result = out.join(" ").replace(/\s+/g, " ").trim();
  if (result && result !== cleaned) {
    await kv.put(key, result);
  }
  return result || cleaned;
}

function looksMostlyCyrillic(text: string): boolean {
  const cyr = (text.match(/[А-Яа-яЁё]/g) ?? []).length;
  const lat = (text.match(/[A-Za-z]/g) ?? []).length;
  return cyr >= 6 && cyr >= lat;
}

function chunkText(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

async function mymemory(text: string): Promise<string | null> {
  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", "en|ru");
    const response = await fetch(url, {
      headers: { "user-agent": "p-news/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number;
    };
    const t = data.responseData?.translatedText?.trim();
    if (!t || /MYMEMORY WARNING/i.test(t)) return null;
    return t;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
