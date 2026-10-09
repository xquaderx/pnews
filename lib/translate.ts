import type { SimpleKv } from "./file-kv.js";
import { createHash } from "node:crypto";

function cacheKey(text: string): string {
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 24);
  return `tr:en-ru:${hash}`;
}

/** Keep ICE (immigration agency) from becoming «лёд» in MT. */
function protectIceAgency(text: string): string {
  return text
    .replace(/\bICE\s+agents?\b/gi, "XXICEAGENTXX")
    .replace(/\bICE\s+officers?\b/gi, "XXICEOFFICERXX")
    .replace(/\bICE\b/g, "XXICEAGENCYXX");
}

function restoreIceAgency(text: string): string {
  return text
    .replace(/XX\s*ICE\s*AGENT(?:S)?\s*XX/gi, "ICE агент")
    .replace(/XXICEAGENT(?:S|XX)?/gi, "ICE агент")
    .replace(/XX\s*ICE\s*OFFICER(?:S)?\s*XX/gi, "ICE офицер")
    .replace(/XXICEOFFICER(?:S|XX)?/gi, "ICE офицер")
    .replace(/XX\s*ICE\s*AGENCY\s*XX/gi, "ICE")
    .replace(/XXICEAGENCYXX/gi, "ICE");
}

/** Free EN→RU via MyMemory; cached in file kv. Falls back to original on failure. */
export async function translateToRu(
  kv: SimpleKv,
  text: string,
): Promise<string> {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (looksMostlyCyrillic(cleaned)) return restoreIceAgency(cleaned);

  const protectedText = protectIceAgency(cleaned);
  const key = cacheKey(protectedText);
  const cached = await kv.get(key);
  if (typeof cached === "string" && cached.length > 0) {
    return restoreIceAgency(cached);
  }

  // MyMemory free tier ~500 bytes/query; chunk long text.
  const chunks = chunkText(protectedText, 420);
  const out: string[] = [];
  for (const chunk of chunks) {
    const translated = await mymemory(chunk);
    out.push(translated ?? chunk);
    await sleep(350);
  }
  const result = restoreIceAgency(out.join(" ").replace(/\s+/g, " ").trim());
  // Reject "translations" that stayed English (quota / passthrough).
  if (!result || !looksMostlyCyrillic(result)) {
    return restoreIceAgency(cleaned);
  }
  await kv.put(key, result);
  return result;
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
