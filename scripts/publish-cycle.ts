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
import { buildNewsCaption, shortenSummary } from "../lib/post-format.js";
import { isSimilarTitle } from "../lib/posted.js";
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

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHANNEL_ID?.trim();
  if (!token || !chatId) {
    throw new Error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID");
  }

  const kv = createFileKv(resolve("data/posted-kv.json"));
  const items = await fetchCandidates();

  type Candidate = {
    item: NewsItem;
    score: number;
    imageUrl: string;
    summary: string;
  };
  const candidates: Candidate[] = [];

  for (const item of items) {
    const dedupe = await findDuplicate(kv, {
      link: item.link,
      title: item.title,
    });
    if (dedupe.duplicate) continue;

    if (
      candidates.some(
        (c) =>
          c.item.link === item.link ||
          isSimilarTitle(c.item.title, item.title),
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
      maxLen: 420,
    });

    let title = sanitizePostText(item.title);
    let summary = sanitizePostText(fullSummary || item.summary);
    if (!title || looksLikeUiJunk(title) || looksLikeUiJunk(summary)) continue;

    const needRu = item.lang === "en" || !looksRussian(`${title}\n${summary}`);
    if (needRu) {
      title = await translateToRu(kv, title);
      summary = await translateToRu(kv, summary);
    }

    summary = shortenSummary(summary, 280);
    title = sanitizePostText(title);
    summary = sanitizePostText(summary);
    if (title.length < 12 || summary.length < 40) continue;
    // Title must be RU — body-only Cyrillic must not let English headlines through.
    if (!looksRussian(title) || !looksRussian(summary)) continue;

    candidates.push({
      item: { ...item, title, summary },
      score: credibility.score,
      imageUrl,
      summary,
    });
  }

  candidates.sort((a, b) => {
    const byTime =
      publishedSortKey(b.item.publishedAt) - publishedSortKey(a.item.publishedAt);
    if (byTime !== 0) return byTime;
    return b.score - a.score;
  });

  const maxPerCycle = Number(process.env.MAX_POSTS_PER_CYCLE ?? "2");
  let posted = 0;
  let failed = 0;

  for (const best of candidates) {
    if (posted >= Math.max(1, maxPerCycle)) break;

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
    });

    const result = await sendTelegramPhoto({
      token,
      chatId,
      photoUrl: best.imageUrl,
      caption: caption.slice(0, 1024),
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
    posted += 1;

    console.log(
      JSON.stringify({
        posted: true,
        messageId: result.messageId,
        title: best.item.title,
        source: best.item.source,
        score: best.score,
        publishedAt: best.item.publishedAt,
      }),
    );
  }

  if (posted === 0) {
    console.log(
      JSON.stringify({
        posted: false,
        reason:
          candidates.length === 0 ? "no_publishable_item" : "all_candidates_failed",
        failed,
        scanned: items.length,
      }),
    );
  } else {
    console.log(JSON.stringify({ cycle_posted: posted, failed }));
  }
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
        )) {
          if (feed.requireUs && !isAboutUs(item.title, item.summary)) continue;
          if (!byLink.has(item.link)) byLink.set(item.link, item);
        }
      } catch {
        // ignore feed errors
      }
    }),
  );

  const maxAgeMs = 1000 * 60 * 60 * 18;
  return [...byLink.values()]
    .filter((i) => isFreshEnough(i.publishedAt, maxAgeMs))
    .sort(
      (a, b) => publishedSortKey(b.publishedAt) - publishedSortKey(a.publishedAt),
    )
    .slice(0, 40);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
