import {
  looksLikeUiJunk,
  stripHtml,
  stripReadMoreBoilerplate,
} from "./text.js";

const UA = "p-news/1.0 (+poloznewss)";

/**
 * Build a self-contained channel summary from RSS text + article lead.
 * Prefers enough context (who / what / why), not a one-liner teaser.
 */
export async function buildFullSummary(input: {
  rssSummary: string;
  articleLink: string;
  maxLen?: number;
}): Promise<string> {
  const maxLen = input.maxLen ?? 900;
  let text = stripReadMoreBoilerplate(stripHtml(input.rssSummary));
  if (looksLikeUiJunk(text)) text = "";

  // Always enrich from the page when the RSS blurb is thin on context.
  const needsMore =
    text.length < 320 ||
    !hasContextCues(text) ||
    /\bleia\s+mais\b/i.test(input.rssSummary) ||
    /\bcontinue\s+lendo\b|\bread\s+more\b/i.test(input.rssSummary);

  if (needsMore) {
    const fromPage = await extractArticleText(input.articleLink);
    if (fromPage && !looksLikeUiJunk(fromPage)) {
      if (!text) {
        text = fromPage;
      } else if (fromPage.length > text.length || !hasContextCues(text)) {
        // Merge unique lead sentences so names/roles from the page stick.
        text = mergeLeads(text, fromPage);
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
  if (lastStop > 160) return sliced.slice(0, lastStop + 1).trim();
  return sliced.trim();
}

/** Heuristic: text already explains who/what (not just a teaser). */
function hasContextCues(text: string): boolean {
  if (text.length < 180) return false;
  const sentences = (text.match(/[.!?]/g) ?? []).length;
  if (sentences < 2) return false;
  // Role / identity cues in EN or RU.
  return (
    /\b(who|which|after|charged|sentenced|governor|senator|president|attorney|suspect|inmate|convicted)\b/i.test(
      text,
    ) ||
    /\b(который|которая|после|обвиня|приговор|губернатор|сенатор|президент|адвокат|заключ|осужд)\b/i.test(
      text,
    )
  );
}

function mergeLeads(a: string, b: string): string {
  const parts = `${a} ${b}`.replace(/\s+/g, " ").trim();
  // Deduplicate near-identical opening sentence.
  const sentences = parts.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [parts];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of sentences) {
    const key = s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s.trim());
    if (out.length >= 6) break;
  }
  return out.join(" ");
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

    const og = pickMeta(html, "og:description") ?? pickMeta(html, "description");
    const ogText = og ? stripHtml(og) : "";

    // Prefer article <p> leads — meta alone is often too thin for context.
    const articleHtml =
      html.match(/<article[\s\S]*?<\/article>/i)?.[0] ??
      html.match(
        /<(?:div|section)[^>]*(?:article|content|materia|news-body|story-body|article-body)[^>]*>[\s\S]*?<\/(?:div|section)>/i,
      )?.[0] ??
      "";

    const scope = articleHtml || html;
    const paragraphs = [...scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => stripHtml(m[1] ?? ""))
      .filter((p) => p.length > 60)
      .filter((p) => !looksLikeUiJunk(p))
      .filter(
        (p) =>
          !/\bleia\s+mais\b|\bnotifica|\bread\s+more\b|\bsubscribe\b|\bcookie\b|\bnewsletter\b/i.test(
            p,
          ),
      )
      .slice(0, 6);

    const fromPars = stripReadMoreBoilerplate(paragraphs.join(" "));
    if (fromPars.length >= 120 && !looksLikeUiJunk(fromPars)) {
      if (
        ogText.length >= 80 &&
        !looksLikeUiJunk(ogText) &&
        !fromPars.toLowerCase().includes(ogText.slice(0, 40).toLowerCase())
      ) {
        return stripReadMoreBoilerplate(`${ogText} ${fromPars}`);
      }
      return fromPars;
    }

    if (ogText.length >= 80 && !looksLikeUiJunk(ogText)) {
      return stripReadMoreBoilerplate(ogText);
    }
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
