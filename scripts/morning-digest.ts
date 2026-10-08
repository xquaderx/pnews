/**
 * Morning digest: 5 short bullets from overnight US news.
 *   npx tsx scripts/morning-digest.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assessCredibility } from "../lib/credibility.js";
import { findDuplicate, rememberPosted } from "../lib/dedupe.js";
import { createFileKv } from "../lib/file-kv.js";
import { buildDigestCaption } from "../lib/post-format.js";
import { polishRussian } from "../lib/ru-polish.js";
import { isNationalEnough } from "../lib/select.js";
import { sanitizePostText } from "../lib/text.js";
import { translateToRu } from "../lib/translate.js";
import {
  US_FEEDS,
  isAboutUs,
  isFreshEnough,
  looksRussian,
  parseRss,
  publishedSortKey,
  readFeedText,
} from "../lib/rss.js";
import {
  seedMessageReaction,
  sendTelegramMessage,
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

const DIGEST_KEY = "meta:morning-digest-day";

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHANNEL_ID?.trim();
  if (!token || !chatId) {
    throw new Error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID");
  }

  const kv = createFileKv(resolve("data/posted-kv.json"));
  const day = new Date().toISOString().slice(0, 10);
  const already = await kv.get(DIGEST_KEY);
  if (already === day) {
    console.log(JSON.stringify({ digest: "already_sent_today", day }));
    return;
  }

  const bullets: string[] = [];
  const seen = new Set<string>();

  for (const feed of US_FEEDS) {
    if (bullets.length >= 5) break;
    try {
      const response = await fetch(feed.url, {
        headers: { "user-agent": "p-news/1.0" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) continue;
      const items = parseRss(
        await readFeedText(response),
        feed.source,
        feed.lang,
        feed.kind,
      )
        .filter((i) => isFreshEnough(i.publishedAt, 1000 * 60 * 60 * 14))
        .filter((i) => !feed.requireUs || isAboutUs(i.title, i.summary))
        .filter((i) => isNationalEnough(i.title, i.summary))
        .sort(
          (a, b) =>
            publishedSortKey(b.publishedAt) - publishedSortKey(a.publishedAt),
        );

      for (const item of items) {
        if (bullets.length >= 5) break;
        const cred = assessCredibility({
          title: item.title,
          summary: item.summary,
          source: item.source,
          articleLink: item.link,
        });
        if (!cred.ok) continue;
        const dup = await findDuplicate(kv, {
          link: item.link,
          title: item.title,
        });
        // Digests may summarize already-posted stories — that's OK once/day.
        let title = sanitizePostText(item.title);
        if (item.lang === "en" || !looksRussian(title)) {
          title = await translateToRu(kv, title);
        }
        title = polishRussian(sanitizePostText(title));
        if (!looksRussian(title) || title.length < 12) continue;
        const key = title.slice(0, 48).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        bullets.push(title);
        if (!dup.duplicate) {
          await rememberPosted(kv, {
            link: `digest://${item.link}`,
            title,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  if (bullets.length < 3) {
    console.log(JSON.stringify({ digest: "not_enough_bullets", n: bullets.length }));
    return;
  }

  const text = buildDigestCaption(bullets.slice(0, 5));
  const result = await sendTelegramMessage({ token, chatId, text });
  if (!result.ok) {
    console.error(JSON.stringify({ digest_failed: result.error }));
    process.exit(1);
  }
  await seedMessageReaction({
    token,
    chatId,
    messageId: result.messageId,
    emoji: "🔥",
  });
  await kv.put(DIGEST_KEY, day);
  console.log(
    JSON.stringify({
      digest: true,
      messageId: result.messageId,
      bullets: bullets.length,
      day,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
