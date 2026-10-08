const UA = "p-news/1.0 (+poloznewss)";

/** Resolve a usable public image for a news item (RSS first, then page meta). */
export async function resolveNewsImage(input: {
  imageUrl?: string | null;
  articleLink: string;
}): Promise<string | null> {
  const candidates: string[] = [];
  if (input.imageUrl) {
    const abs = absoluteUrl(input.imageUrl, input.articleLink);
    if (abs) candidates.push(abs);
  }

  try {
    const response = await fetch(input.articleLink, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (response.ok) {
      const html = await response.text();
      const fromMeta = pickMetaImage(html);
      const abs = fromMeta ? absoluteUrl(fromMeta, input.articleLink) : null;
      if (abs) candidates.push(abs);
    }
  } catch {
    // ignore page fetch errors
  }

  for (const url of candidates) {
    if (!isLikelyImageUrl(url)) continue;
    if (await urlServesImage(url)) return url;
  }
  return null;
}

async function urlServesImage(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(8_000),
      redirect: "follow",
    });
    if (!response.ok) return false;
    const finalUrl = response.url || url;
    if (/\.(ghtml|html|htm)(\?|$)/i.test(finalUrl)) return false;
    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    if (type.startsWith("image/")) return true;
    // Some CDNs block HEAD; allow known image URL shapes after redirect check.
    return isLikelyImageUrl(finalUrl);
  } catch {
    return isLikelyImageUrl(url);
  }
}

function pickMetaImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeHtml(m[1]);
  }
  return null;
}

function absoluteUrl(url: string, base: string): string | null {
  try {
    const abs = new URL(url, base).toString();
    return isLikelyImageUrl(abs) ? abs : null;
  } catch {
    return null;
  }
}

function isLikelyImageUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  const lower = url.toLowerCase();
  if (lower.includes(".svg") || lower.includes("format(svg")) return false;
  // Reject article pages accidentally treated as images.
  if (/\.(ghtml|html|htm|php|aspx)(\?|$)/i.test(lower)) return false;
  if (
    /\.(jpe?g|png|webp|gif)(\?|$)/i.test(lower) ||
    /\/(image|images|img|photos?|media|thumbnails?)\//i.test(lower) ||
    /(glbimg|bbci\.co\.uk\/ace|imagens\.ebc|ichef\.bbci|s2-g1\.glbimg|i\.s3\.glbimg)/i.test(
      lower,
    )
  ) {
    return true;
  }
  return false;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
