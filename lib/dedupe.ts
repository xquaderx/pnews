import type { SimpleKv } from "./file-kv.js";
import {
  canonicalizeLink,
  isSimilarTitle,
  postedKey,
  RECENT_TITLES_KEY,
  storyKey,
  titleKey,
  type RecentTitles,
} from "./posted.js";

export type DedupeHit = {
  duplicate: boolean;
  reason?: "link" | "title" | "story" | "similar_title";
};

export async function findDuplicate(
  kv: SimpleKv,
  input: { link: string; title: string },
): Promise<DedupeHit> {
  const link = canonicalizeLink(input.link);

  if ((await kv.get(postedKey(link))) !== undefined) {
    return { duplicate: true, reason: "link" };
  }
  if ((await kv.get(titleKey(input.title))) !== undefined) {
    return { duplicate: true, reason: "title" };
  }
  if ((await kv.get(storyKey(input.title))) !== undefined) {
    return { duplicate: true, reason: "story" };
  }

  const recent = (await kv.get(RECENT_TITLES_KEY)) as RecentTitles | undefined;
  for (const prev of recent?.titles ?? []) {
    if (isSimilarTitle(input.title, prev)) {
      return { duplicate: true, reason: "similar_title" };
    }
  }
  return { duplicate: false };
}

export async function rememberPosted(
  kv: SimpleKv,
  input: {
    link: string;
    title: string;
    messageId?: number;
  },
): Promise<void> {
  const link = canonicalizeLink(input.link);
  const record = {
    link,
    title: input.title,
    postedAt: new Date().toISOString(),
    ...(typeof input.messageId === "number"
      ? { messageId: input.messageId }
      : {}),
  };
  await kv.put(postedKey(link), record);
  await kv.put(titleKey(input.title), record);
  await kv.put(storyKey(input.title), record);

  const recent = (await kv.get(RECENT_TITLES_KEY)) as RecentTitles | undefined;
  const titles = [input.title, ...(recent?.titles ?? [])]
    .filter((t, i, arr) => arr.findIndex((x) => isSimilarTitle(x, t) || x === t) === i)
    .slice(0, 200);
  await kv.put(RECENT_TITLES_KEY, { titles });
}
