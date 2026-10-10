/**
 * Free publisher for @PolozNewss: RSS → filter → RU → Telegram photo.
 *
 *   npx tsx scripts/publish-cycle.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildFullSummary } from "../lib/article.js";
import { assessCredibility } from "../lib/credibility.js";
import { findDuplicate, rememberPosted } from "../lib/dedupe.js";
import { createFileKv } from "../lib/file-kv.js";
import { resolveNewsImage } from "../lib/image.js";
import {
  isExplainableBody,
  isThinProductTitle,
  withOutsiderContext,
} from "../lib/explain.js";
import {
  BODY_MAX_LEN,
  BODY_MAX_SENTENCES,
  buildNewsCaption,
  dropTornFragments,
  looksTornText,
  shortenSummary,
} from "../lib/post-format.js";
import { collapseSimilarItems, isSimilarTitle } from "../lib/posted.js";
import { looksBrokenRussian, polishRussian } from "../lib/ru-polish.js";
import {
  cleanHeadline,
  detectPostMode,
  extractQuote,
  isLiveBlogOrRoundupTitle,
  isNationalEnough,
} from "../lib/select.js";
import { looksLikeUiJunk, sanitizePostText } from "../lib/text.js";
import { translateToRu } from "../lib/translate.js";
import {
  US_FEEDS,
  isAboutUs,
  isFreshEnough,
  looksRussian,
  parseRss,
  publishedSortKey,
  readFeedText,
  type NewsItem,
} from "../lib/rss.js";
import {
  seedMessageReaction,
  sendTelegramPhoto,
} from "../lib/telegram.js";

function loadEnvFile(path: string): void {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1]!;
      let val = m[2]!;
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // optional
  }
}

loadEnvFile(resolve(".env.local"));
loadEnvFile(resolve(".env"));

/** Pace ledger: caps daily volume so the channel does not flood. */
const PACE_KEY = "meta:publish-pace";

type PaceState = {
  day: string; // YYYY-MM-DD UTC
  /** Regular posts that count toward the daily comfort cap. */
  count: number;
  /** Urgent posts that may exceed the regular cap. */
  urgentCount: number;
  lastPostedAt?: string;
};

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHANNEL_ID?.trim();
  if (!token || !chatId) {
    throw new Error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID");
  }

  const kv = createFileKv(resolve("data/posted-kv.json"));
  const pace = await readPace(kv);
  const maxPerDay = Math.max(1, Number(process.env.MAX_POSTS_PER_DAY ?? "10"));
  const maxUrgentPerDay = Math.max(
    0,
    Number(process.env.MAX_URGENT_PER_DAY ?? "5"),
  );
  const minGapMin = Math.max(
    30,
    Number(process.env.MIN_MINUTES_BETWEEN_POSTS ?? "90"),
  );
  const urgentGapMin = Math.max(
    10,
    Number(process.env.MIN_MINUTES_BETWEEN_URGENT ?? "20"),
  );

  const atDailyCap = pace.count >= maxPerDay;
  const gapMs = pace.lastPostedAt
    ? Date.now() - Date.parse(pace.lastPostedAt)
    : Number.POSITIVE_INFINITY;
  const inNormalGap =
    Number.isFinite(gapMs) && gapMs < minGapMin * 60_000;
  const inUrgentGap =
    Number.isFinite(gapMs) && gapMs < urgentGapMin * 60_000;

  // When the regular day is full / gap is open, we still look for urgent news.
  if (atDailyCap && pace.urgentCount >= maxUrgentPerDay) {
    console.log(
      JSON.stringify({
        posted: false,
        reason: "daily_cap",
        day: pace.day,
        count: pace.count,
        urgentCount: pace.urgentCount,
        maxPerDay,
        maxUrgentPerDay,
      }),
    );
    return;
  }

  const items = await fetchCandidates();

  type Candidate = {
    item: NewsItem;
    originalTitle: string;
    score: number;
    imageUrl: string;
    summary: string;
    mode: ReturnType<typeof detectPostMode>;
    quote: string | null;
  };
  const candidates: Candidate[] = [];

  for (const item of items) {
    if (isThinProductTitle(item.title)) continue;
    if (!isNationalEnough(item.title, item.summary)) continue;

    const dedupe = await findDuplicate(kv, {
      link: item.link,
      title: item.title,
    });
    if (dedupe.duplicate) continue;

    if (
      candidates.some(
        (c) =>
          c.item.link === item.link ||
          isSimilarTitle(c.item.title, item.title) ||
          isSimilarTitle(c.originalTitle, item.title),
      )
    ) {
      continue;
    }

    const credibility = assessCredibility({
      title: item.title,
      summary: item.summary,
      source: item.source,
      articleLink: item.link,
    });
    if (!credibility.ok) continue;

    const imageUrl = await resolveNewsImage({
      imageUrl: item.imageUrl,
      articleLink: item.link,
    });
    if (!imageUrl) continue;

    const fullSummary = await buildFullSummary({
      rssSummary: item.summary,
      articleLink: item.link,
      maxLen: 1400,
    });

    const originalTitle = sanitizePostText(item.title);
    let title = originalTitle;
    let summary = sanitizePostText(fullSummary || item.summary);
    if (!title || looksLikeUiJunk(title) || looksLikeUiJunk(summary)) continue;
    // Need a real article lead before we bother translating.
    if (summary.length < 160) continue;

    const needRu = item.lang === "en" || !looksRussian(`${title}\n${summary}`);
    if (needRu) {
      title = await translateToRu(kv, title);
      summary = await translateToRu(kv, summary);
    }

    title = polishRussian(sanitizePostText(cleanHeadline(title)));
    summary = polishRussian(sanitizePostText(summary));
    if (isLiveBlogOrRoundupTitle(title) || isLiveBlogOrRoundupTitle(originalTitle)) {
      console.log(
        JSON.stringify({
          skipped: true,
          reason: "live_blog_roundup",
          title,
        }),
      );
      continue;
    }
    // One short background clause max — no dictionary dumps.
    summary = withOutsiderContext(title, summary);
    summary = polishRussian(
      dropTornFragments(
        sanitizePostText(
          shortenSummary(summary, BODY_MAX_LEN, BODY_MAX_SENTENCES),
        ),
      ),
    );
    title = polishRussian(cleanHeadline(title));

    if (title.length < 12) continue;
    if (!looksRussian(title) || !looksRussian(summary)) continue;
    if (looksBrokenRussian(title) || looksBrokenRussian(summary)) {
      console.log(
        JSON.stringify({
          skipped: true,
          reason: "broken_russian",
          title,
        }),
      );
      continue;
    }
    if (looksTornText(summary)) {
      console.log(
        JSON.stringify({
          skipped: true,
          reason: "torn_summary",
          title,
        }),
      );
      continue;
    }
    if (!isExplainableBody(title, summary)) {
      console.log(
        JSON.stringify({
          skipped: true,
          reason: "not_explainable",
          title,
        }),
      );
      continue;
    }

    const mode = detectPostMode({ title, summary });

    // Dedupe again against polished RU title (catches prior translations).
    const ruDup = await findDuplicate(kv, { link: item.link, title });
    if (ruDup.duplicate) continue;

    candidates.push({
      item: { ...item, title, summary },
      originalTitle,
      score: credibility.score + kindBonus(item.kind),
      imageUrl,
      summary,
      mode,
      quote: extractQuote(summary),
    });
  }

  // Prefer mix: avoid posting 2 pure politics if economy/tech available.
  candidates.sort((a, b) => {
    const byTime =
      publishedSortKey(b.item.publishedAt) - publishedSortKey(a.item.publishedAt);
    if (byTime !== 0) return byTime;
    return b.score - a.score;
  });

  // Default 1: research + reader feedback — avoid bursts.
  const maxPerCycle = Math.max(1, Number(process.env.MAX_POSTS_PER_CYCLE ?? "1"));
  const roomToday = Math.max(0, maxPerDay - pace.count);
  const urgentRoom = Math.max(0, maxUrgentPerDay - pace.urgentCount);
  let posted = 0;
  let failed = 0;
  const usedKinds = new Set<string>();

  // Prefer urgent first when the regular day is full or the long gap is open.
  const ordered = [...candidates].sort((a, b) => {
    const au = a.mode === "important" ? 1 : 0;
    const bu = b.mode === "important" ? 1 : 0;
    if (au !== bu) return bu - au;
    return 0;
  });

  for (const best of ordered) {
    const urgent = best.mode === "important";
    if (urgent) {
      if (urgentRoom <= 0) continue;
      if (inUrgentGap) continue;
    } else {
      if (atDailyCap || roomToday <= 0) continue;
      if (inNormalGap) continue;
    }
    if (posted >= maxPerCycle) break;

    // Soft diversity: if we already posted politics, prefer another kind once.
    if (
      posted > 0 &&
      usedKinds.has("politics") &&
      best.item.kind === "politics" &&
      ordered.some(
        (c) =>
          c.item.kind !== "politics" &&
          !usedKinds.has(c.item.kind) &&
          c !== best,
      )
    ) {
      continue;
    }

    const again = await findDuplicate(kv, {
      link: best.item.link,
      title: best.item.title,
    });
    if (again.duplicate) {
      console.log(
        JSON.stringify({
          skipped: true,
          reason: again.reason,
          title: best.item.title,
        }),
      );
      continue;
    }

    const caption = buildNewsCaption({
      title: best.item.title,
      summary: best.summary,
      source: best.item.source,
      kind: best.item.kind,
      mode: best.mode,
      quote: best.quote,
    });
    // Footer + pins are reserved inside buildNewsCaption — never hard-slice them off.
    if (
      !caption.includes("📍") ||
      !caption.includes("Комментируйте") ||
      !caption.includes("Оставьте реакцию") ||
      !caption.includes("P News. Подписаться")
    ) {
      console.error("caption_missing_format", best.item.title);
    }
    if (/\bAP\b|Reuters|Associated Press/i.test(caption.replace(/<[^>]+>/g, ""))) {
      console.error("caption_leaked_outlet", best.item.title);
    }

    const result = await sendTelegramPhoto({
      token,
      chatId,
      photoUrl: best.imageUrl,
      caption,
    });
    if (!result.ok) {
      failed += 1;
      console.error("post_failed", result.error, best.item.link);
      continue;
    }

    await seedMessageReaction({
      token,
      chatId,
      messageId: result.messageId,
      emoji: "🔥",
    });
    await rememberPosted(kv, {
      link: best.item.link,
      title: best.item.title,
      messageId: result.messageId,
    });
    // Also fingerprint the English title so translated rewrites don't repost.
    if (best.originalTitle !== best.item.title) {
      await rememberPosted(kv, {
        link: `${best.item.link}#en-title`,
        title: best.originalTitle,
      });
    }
    posted += 1;
    usedKinds.add(best.item.kind);
    await bumpPace(kv, pace, urgent);

    console.log(
      JSON.stringify({
        posted: true,
        messageId: result.messageId,
        title: best.item.title,
        source: best.item.source,
        kind: best.item.kind,
        mode: best.mode,
        urgent,
        score: best.score,
        publishedAt: best.item.publishedAt,
        dayCount: pace.count,
        urgentCount: pace.urgentCount,
        maxPerDay,
      }),
    );
  }

  if (posted === 0) {
    let reason = "no_publishable_item";
    if (candidates.length > 0) {
      if (atDailyCap && !ordered.some((c) => c.mode === "important")) {
        reason = "daily_cap";
      } else if (inNormalGap && !ordered.some((c) => c.mode === "important")) {
        reason = "min_gap";
      } else if (failed > 0) {
        reason = "all_candidates_failed";
      } else {
        reason = "pace_blocked";
      }
    }
    console.log(
      JSON.stringify({
        posted: false,
        reason,
        failed,
        scanned: items.length,
        dayCount: pace.count,
        urgentCount: pace.urgentCount,
        maxPerDay,
      }),
    );
  } else {
    console.log(JSON.stringify({ cycle_posted: posted, failed }));
  }
}

function kindBonus(kind: NewsItem["kind"]): number {
  if (kind === "economy" || kind === "tech" || kind === "weather") return 5;
  return 0;
}

async function readPace(kv: ReturnType<typeof createFileKv>): Promise<PaceState> {
  const day = new Date().toISOString().slice(0, 10);
  const prev = (await kv.get(PACE_KEY)) as PaceState | undefined;
  if (!prev || prev.day !== day) {
    return { day, count: 0, urgentCount: 0 };
  }
  return {
    day,
    count: Number(prev.count) || 0,
    urgentCount: Number(prev.urgentCount) || 0,
    lastPostedAt: prev.lastPostedAt,
  };
}

async function bumpPace(
  kv: ReturnType<typeof createFileKv>,
  pace: PaceState,
  urgent: boolean,
): Promise<void> {
  if (urgent) {
    pace.urgentCount += 1;
  } else {
    pace.count += 1;
  }
  pace.lastPostedAt = new Date().toISOString();
  await kv.put(PACE_KEY, pace);
}

async function fetchCandidates(): Promise<NewsItem[]> {
  const byLink = new Map<string, NewsItem>();
  await Promise.all(
    US_FEEDS.map(async (feed) => {
      try {
        const response = await fetch(feed.url, {
          headers: {
            "user-agent": "p-news/1.0",
            accept: "application/rss+xml, application/xml, text/xml, */*",
          },
          signal: AbortSignal.timeout(12_000),
        });
        if (!response.ok) return;
        for (const item of parseRss(
          await readFeedText(response),
          feed.source,
          feed.lang,
          feed.kind,
        )) {
          if (feed.requireUs && !isAboutUs(item.title, item.summary)) continue;
          if (!byLink.has(item.link)) byLink.set(item.link, item);
        }
      } catch {
        // ignore feed errors
      }
    }),
  );

  const maxAgeMs = 1000 * 60 * 60 * 24;
  const fresh = [...byLink.values()]
    .filter((i) => isFreshEnough(i.publishedAt, maxAgeMs))
    .sort(
      (a, b) => publishedSortKey(b.publishedAt) - publishedSortKey(a.publishedAt),
    );
  // One story → one candidate, even if 8 outlets rewrote the same headline.
  return collapseSimilarItems(fresh).slice(0, 100);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
