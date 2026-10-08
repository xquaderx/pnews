import { escapeHtml } from "./telegram.js";
import { sanitizePostText } from "./text.js";
import type { PostMode } from "./select.js";

export const CHANNEL_PUBLIC_URL = "https://t.me/PolozNewss";
export const CHANNEL_CTA_LABEL = "P News. Подписаться";
export const BRASIL_CHANNEL_URL = "https://t.me/pbrasilagora";

/** Soft target for body; final fit always keeps CTAs inside 1024. */
export const BODY_MAX_LEN = 650;
export const BODY_MAX_SENTENCES = 5;

const ENGAGE_LINES = [
  "💬 Комментируйте ниже, что думаете",
  "🔥 Оставьте реакцию на пост",
] as const;

function footerBlock(): string {
  return [
    ...ENGAGE_LINES,
    `👉 <a href="${CHANNEL_PUBLIC_URL}">${escapeHtml(CHANNEL_CTA_LABEL)}</a>`,
  ].join("\n");
}

export function buildNewsCaption(input: {
  title: string;
  summary: string;
  /** Kept for callers; not shown in the channel caption. */
  source?: string;
  mode?: PostMode;
  quote?: string | null;
}): string {
  const title = sanitizePostText(input.title);
  const mode = input.mode ?? "normal";
  const bolt = mode === "important" ? "❗️" : "⚡️";
  const headline = `${bolt} <b>${escapeHtml(title)}</b>`;
  const footer = footerBlock();

  let summary = sanitizePostText(input.summary);
  let quote =
    mode === "important" && input.quote
      ? sanitizePostText(input.quote)
      : "";

  // Shrink body until headline + body + quote + footer fit Telegram's 1024 limit.
  for (let i = 0; i < 8; i++) {
    const parts = [headline, ""];
    if (summary) {
      parts.push(escapeHtml(summary), "");
    }
    if (quote) {
      parts.push(`<blockquote>${escapeHtml(quote)}</blockquote>`, "");
    }
    parts.push(footer);
    const caption = parts.join("\n");
    if (caption.length <= 1024) return caption;

    const overflow = caption.length - 1024;
    if (quote.length > 40) {
      quote = shortenSummary(quote, Math.max(40, quote.length - overflow - 20), 2);
      continue;
    }
    if (summary.length > 80) {
      summary = shortenSummary(
        summary,
        Math.max(80, summary.length - overflow - 20),
        Math.max(2, BODY_MAX_SENTENCES - i),
      );
      continue;
    }
    // Last resort: drop quote, keep short body + footer.
    quote = "";
    summary = shortenSummary(summary, 80, 2);
  }

  // Guaranteed footer even if title is huge.
  const fallback = [headline, "", footer].join("\n");
  if (fallback.length <= 1024) return fallback;
  const shortTitle = escapeHtml(title).slice(0, 200);
  return [`${bolt} <b>${shortTitle}</b>`, "", footer].join("\n").slice(0, 1024);
}

export function buildDigestCaption(bullets: string[]): string {
  const lines = bullets.map((b) => `• ${escapeHtml(sanitizePostText(b))}`);
  const footer = footerBlock();
  let body = lines.join("\n");
  let caption = ["🗞 <b>P News — главное за ночь</b>", "", body, "", footer].join(
    "\n",
  );
  while (caption.length > 1024 && lines.length > 3) {
    lines.pop();
    body = lines.join("\n");
    caption = ["🗞 <b>P News — главное за ночь</b>", "", body, "", footer].join(
      "\n",
    );
  }
  return caption.slice(0, 1024);
}

export function buildBrasilCrossPromo(): string {
  return [
    "🇧🇷 <b>Читаете США — загляните и в Бразилию</b>",
    "",
    "Сестринский канал <b>P Brasil Agora</b> — новости Бразилии на португальском, тот же короткий формат.",
    "",
    `👉 <a href="${BRASIL_CHANNEL_URL}">P Brasil Agora. Inscrever-se</a>`,
    "",
    `👉 <a href="${CHANNEL_PUBLIC_URL}">${escapeHtml(CHANNEL_CTA_LABEL)}</a>`,
  ].join("\n");
}

export function buildPinText(): string {
  return [
    "🇺🇸 <b>P News — новости из США</b>",
    "",
    "Объясняем новости США так, чтобы было понятно даже без знания страны: кто это, что случилось и почему важно.",
    "",
    "Формат поста:",
    "⚡️ заголовок",
    "подробный контекст",
    "💬 комментарий · 🔥 реакция",
    "",
    "Пишите в комментариях под постами — обсуждение включено.",
    "",
    `Канал: <a href="${CHANNEL_PUBLIC_URL}">@PolozNewss</a>`,
    `Бразилия: <a href="${BRASIL_CHANNEL_URL}">@pbrasilagora</a>`,
  ].join("\n");
}

/**
 * Keep a clear explainer body: several sentences, cut on boundaries.
 */
export function shortenSummary(
  text: string,
  maxLen = BODY_MAX_LEN,
  maxSentences = BODY_MAX_SENTENCES,
): string {
  const clean = sanitizePostText(text).replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= maxLen) {
    return trimToSentences(clean, maxSentences);
  }
  const sliced = clean.slice(0, maxLen);
  const lastStop = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? "),
  );
  if (lastStop > 120) {
    return trimToSentences(sliced.slice(0, lastStop + 1).trim(), maxSentences);
  }
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace > 120) return `${sliced.slice(0, lastSpace).trim()}…`;
  return `${sliced.trim()}…`;
}

function trimToSentences(text: string, maxSentences: number): string {
  const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  return parts.slice(0, maxSentences).join(" ").trim();
}
