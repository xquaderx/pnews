import {
  looksLikeUiJunk,
  stripHtml,
  stripReadMoreBoilerplate,
} from "./text.js";

const UA = "p-news/1.0 (+poloznewss)";

/**
 * Build a self-contained channel summary from RSS text + clean article meta.
 * Never leaves "Leia mais", site notification CTAs, or scraped UI/CSS junk.
 */
export async function buildFullSummary(input: {
  rssSummary: string;
  articleLink: string;
  maxLen?: number;
}): Promise<string> {
  const maxLen = input.maxLen ?? 700;
  let text = stripReadMoreBoilerplate(stripHtml(input.rssSummary));
  if (looksLikeUiJunk(text)) text = "";

  const needsMore =
    text.length < 160 ||
    /\bleia\s+mais\b/i.test(input.rssSummary) ||
    /\bcontinue\s+lendo\b/i.test(input.rssSummary);

  if (needsMore) {
    const fromPage = await extractArticleText(input.articleLink);
    if (fromPage && !looksLikeUiJunk(fromPage)) {
      // Prefer page meta/body only when cleaner/longer than RSS.
      if (fromPage.length > text.length || looksLikeUiJunk(text) || !text) {
        text = fromPage;
      }
    }
  }

  text = stripReadMoreBoilerplate(text);
  if (looksLikeUiJunk(text)) return "";

  if (text.length <= maxLen) return text;

  const sliced = text.slice(0, maxLen);
  const lastStop = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? "),
  );
  if (lastStop > 120) return sliced.slice(0, lastStop + 1).trim();
  return sliced.trim();
}

async function extractArticleText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!response.ok) return null;
    const buf = Buffer.from(await response.arrayBuffer());
    const httpCs =
      response.headers.get("content-type")?.match(/charset=([^\s;]+)/i)?.[1] ??
      "";
    const head = buf.subarray(0, 800).toString("latin1");
    const htmlCs =
      head.match(/charset=["']?([^\s"'/>]+)/i)?.[1] ??
      head.match(/encoding=["']([^"']+)["']/i)?.[1] ??
      "";
    const charset = normalizeCharset(htmlCs || httpCs || "utf-8");
    const html = decodeBuffer(buf, charset);

    // Prefer clean meta description — avoids nav/notification widgets.
    const og = pickMeta(html, "og:description") ?? pickMeta(html, "description");
    const ogText = og ? stripHtml(og) : "";
    if (ogText.length >= 80 && !looksLikeUiJunk(ogText)) {
      return stripReadMoreBoilerplate(ogText);
    }

    // Fallback: only clean <p> inside article-like containers.
    const articleHtml =
      html.match(/<article[\s\S]*?<\/article>/i)?.[0] ??
      html.match(
        /<(?:div|section)[^>]*(?:article|content|materia|news-body)[^>]*>[\s\S]*?<\/(?:div|section)>/i,
      )?.[0] ??
      "";

    const scope = articleHtml || html;
    const paragraphs = [...scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => stripHtml(m[1] ?? ""))
      .filter((p) => p.length > 70)
      .filter((p) => !looksLikeUiJunk(p))
      .filter((p) => !/\bleia\s+mais\b|\bnotifica/i.test(p))
      .slice(0, 4);

    const merged = stripReadMoreBoilerplate(paragraphs.join(" "));
    if (merged.length >= 80 && !looksLikeUiJunk(merged)) return merged;
    return null;
  } catch {
    return null;
  }
}

function pickMeta(html: string, name: string): string | null {
  const prop = name.startsWith("og:") ? "property" : "name";
  const re1 = new RegExp(
    `<meta[^>]+${prop}=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+${prop}=["']${name}["']`,
    "i",
  );
  return html.match(re1)?.[1] ?? html.match(re2)?.[1] ?? null;
}

function normalizeCharset(raw: string): string {
  const c = raw.trim().toLowerCase().replace(/utf8/, "utf-8");
  if (c === "iso-8859-1" || c === "latin-1" || c === "latin1") return "latin1";
  if (c === "windows-1252" || c === "cp1252") return "windows-1252";
  return "utf-8";
}

function decodeBuffer(buf: Buffer, charset: string): string {
  try {
    if (charset === "latin1") return buf.toString("latin1");
    return new TextDecoder(charset).decode(buf);
  } catch {
    return buf.toString("utf8");
  }
}
