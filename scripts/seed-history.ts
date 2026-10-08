/**
 * Seed dedupe KV from public t.me/s/PolozNewss so we never re-post
 * (or delete) existing channel messages.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { rememberPosted } from "../lib/dedupe.js";
import { createFileKv } from "../lib/file-kv.js";

async function main(): Promise<void> {
  const html = await fetch("https://t.me/s/PolozNewss", {
    headers: { "user-agent": "p-news-seed/1.0" },
    signal: AbortSignal.timeout(20_000),
  }).then((r) => r.text());

  const titles = new Set<string>();
  // Telegram public preview wraps text in tgme_widget_message_text
  const blocks =
    html.match(
      /tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/gi,
    ) ?? [];

  for (const block of blocks) {
    const plain = block
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/\s+/g, " ")
      .trim();
    const m = plain.match(/⚡\s*(.+?)(?:👉|$)/);
    const title = (m?.[1] ?? "").trim();
    if (title.length >= 12) titles.add(title.slice(0, 240));
  }

  await mkdir(resolve("data"), { recursive: true });
  const kv = createFileKv(resolve("data/posted-kv.json"));
  let n = 0;
  for (const title of titles) {
    // Synthetic link — title/story keys still block rewrites of the same headline.
    const link = `https://t.me/PolozNewss/history#${encodeURIComponent(title.slice(0, 80))}`;
    await rememberPosted(kv, { link, title });
    n += 1;
  }

  await writeFile(
    resolve("data/seed-report.json"),
    JSON.stringify({ seededTitles: n, sample: [...titles].slice(0, 5) }, null, 2),
  );
  console.log(JSON.stringify({ seededTitles: n }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
