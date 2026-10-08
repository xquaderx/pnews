import { decodeEntities, stripHtml, stripReadMoreBoilerplate } from "./text.js";

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
  source: string;
  imageUrl: string | null;
  lang: "ru" | "en";
  kind: FeedKind;
};

export type FeedKind = "politics" | "economy" | "tech" | "weather" | "crime" | "general";

export async function readFeedText(response: Response): Promise<string> {
  const buf = Buffer.from(await response.arrayBuffer());
  const httpCs =
    response.headers.get("content-type")?.match(/charset=([^\s;]+)/i)?.[1] ??
    "";
  const head = buf.subarray(0, 400).toString("latin1");
  const xmlCs = head.match(/encoding=["']([^"']+)["']/i)?.[1] ?? "";
  const raw = (xmlCs || httpCs || "utf-8").trim().toLowerCase();
  if (raw.includes("8859-1") || raw.includes("latin")) {
    return buf.toString("latin1");
  }
  try {
    return new TextDecoder("utf-8").decode(buf);
  } catch {
    return buf.toString("utf8");
  }
}

function tagContent(block: string, tag: string): string | null {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
    "i",
  );
  const match = block.match(re);
  return match ? decodeEntities(match[1]!).trim() : null;
}

function unwrapRedirectLink(link: string): string {
  const starred = link.match(/\*(https?:\/\/\S+)/i);
  if (starred?.[1]) return starred[1];
  try {
    const url = new URL(link);
    if (url.hostname.includes("news.google.")) {
      const real = url.searchParams.get("url");
      if (real && /^https?:\/\//i.test(real)) return real;
    }
  } catch {
    // ignore
  }
  return link;
}

function linkFromItem(block: string): string | null {
  const tagged = tagContent(block, "link");
  if (tagged && /^https?:\/\//i.test(tagged)) return unwrapRedirectLink(tagged);
  const atom = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (atom?.[1] && /^https?:\/\//i.test(atom[1])) {
    return unwrapRedirectLink(atom[1]);
  }
  const guid = tagContent(block, "guid");
  if (guid && /^https?:\/\//i.test(guid)) return unwrapRedirectLink(guid);
  return null;
}

function imageFromItem(block: string): string | null {
  const media =
    block.match(
      /<(?:media:content|media:thumbnail|enclosure)[^>]+url=["']([^"']+)["']/i,
    ) ??
    block.match(
      /<(?:media:content|media:thumbnail|enclosure)[^>]+url=([^\s>]+)/i,
    );
  if (media?.[1] && /^https?:\/\//i.test(media[1])) return media[1];
  const img = block.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (img?.[1] && /^https?:\/\//i.test(img[1])) return img[1];
  return null;
}

export function parseRss(
  xml: string,
  source: string,
  lang: "ru" | "en",
  kind: FeedKind = "general",
): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ??
    xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ??
    [];

  for (const block of blocks) {
    const title = stripHtml(tagContent(block, "title") ?? "");
    const link = linkFromItem(block);
    if (!title || !link) continue;

    const summaryRaw =
      tagContent(block, "content:encoded") ??
      tagContent(block, "description") ??
      tagContent(block, "summary") ??
      tagContent(block, "content") ??
      "";
    const publishedAt =
      tagContent(block, "pubDate") ??
      tagContent(block, "updated") ??
      tagContent(block, "published") ??
      null;

    items.push({
      id: link,
      title: stripReadMoreBoilerplate(title),
      link,
      summary: stripReadMoreBoilerplate(stripHtml(summaryRaw)).slice(0, 900),
      publishedAt,
      source,
      imageUrl: imageFromItem(block),
      lang,
      kind,
    });
  }

  return items;
}

export type UsFeed = {
  source: string;
  url: string;
  lang: "ru" | "en";
  kind: FeedKind;
  /** When true, keep only US-related items (for mixed world feeds). */
  requireUs?: boolean;
};

export const US_FEEDS: ReadonlyArray<UsFeed> = [
  // Politics
  {
    source: "The Hill",
    url: "https://thehill.com/feed/",
    lang: "en",
    kind: "politics",
  },
  {
    source: "NPR",
    url: "https://feeds.npr.org/1001/rss.xml",
    lang: "en",
    kind: "general",
  },
  {
    source: "NYT Politics",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml",
    lang: "en",
    kind: "politics",
  },
  {
    source: "CBS Politics",
    url: "https://www.cbsnews.com/latest/rss/politics",
    lang: "en",
    kind: "politics",
  },
  {
    source: "ABC Politics",
    url: "https://abcnews.go.com/abcnews/politicsheadlines",
    lang: "en",
    kind: "politics",
  },
  {
    source: "BBC US & Canada",
    url: "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
    lang: "en",
    kind: "politics",
  },
  {
    source: "BBC Russian",
    url: "https://feeds.bbci.co.uk/russian/rss.xml",
    lang: "ru",
    kind: "politics",
    requireUs: true,
  },
  {
    source: "CBS US",
    url: "https://www.cbsnews.com/latest/rss/us",
    lang: "en",
    kind: "general",
  },

  // Economy
  {
    source: "NYT Business",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    lang: "en",
    kind: "economy",
    requireUs: true,
  },
  {
    source: "CNBC",
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    lang: "en",
    kind: "economy",
    requireUs: true,
  },
  {
    source: "NPR Business",
    url: "https://feeds.npr.org/1017/rss.xml",
    lang: "en",
    kind: "economy",
  },
  {
    source: "BBC Business",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    lang: "en",
    kind: "economy",
    requireUs: true,
  },

  // Tech
  {
    source: "NYT Technology",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
    lang: "en",
    kind: "tech",
    requireUs: true,
  },
  {
    source: "TechCrunch",
    url: "https://feeds.feedburner.com/TechCrunch",
    lang: "en",
    kind: "tech",
    requireUs: true,
  },
  {
    source: "NPR Science",
    url: "https://feeds.npr.org/1007/rss.xml",
    lang: "en",
    kind: "tech",
  },

  // Weather / disasters
  {
    source: "NHC Atlantic",
    url: "https://www.nhc.noaa.gov/index-at.xml",
    lang: "en",
    kind: "weather",
  },
];

/** True when story is about the US / US politics. */
export function isAboutUs(title: string, summary: string): boolean {
  const text = `${title}\n${summary}`;
  return (
    /\b(U\.?S\.?A?\.?|United States|America[n]?)\b/i.test(text) ||
    /\b(White House|Congress|Senate|House of Representatives|Pentagon|FBI|CIA|SCOTUS|Supreme Court)\b/i.test(
      text,
    ) ||
    /\b(Trump|Biden|Harris|Vance|Obama|Newsom|RFK|Musk|SpaceX|Nvidia|Apple|Tesla|Fed|Wall Street|Silicon Valley)\b/i.test(
      text,
    ) ||
    /\b(California|Texas|Florida|Washington|New York|Iowa)\b/i.test(text) ||
    /\b(США|Америк|Вашингтон|Белый дом|Конгресс|Сенат|Пентагон)\b/i.test(
      text,
    ) ||
    /\b(Трамп|Байден|Харрис|Вэнс|Обама|Ньюсом|Маск)\b/i.test(text) ||
    /\b(hurricane|tropical storm|wildfire|tornado)\b/i.test(text)
  );
}

export function looksRussian(text: string): boolean {
  const cyr = (text.match(/[А-Яа-яЁё]/g) ?? []).length;
  const lat = (text.match(/[A-Za-z]/g) ?? []).length;
  return cyr >= 8 && cyr >= lat * 0.4;
}

export function isFreshEnough(
  publishedAt: string | null,
  maxAgeMs = 1000 * 60 * 60 * 18,
  now = Date.now(),
): boolean {
  if (!publishedAt) return true;
  const ts = Date.parse(publishedAt);
  if (Number.isNaN(ts)) return true;
  return now - ts <= maxAgeMs;
}

export function publishedSortKey(publishedAt: string | null): number {
  if (!publishedAt) return 0;
  const ts = Date.parse(publishedAt);
  return Number.isNaN(ts) ? 0 : ts;
}
