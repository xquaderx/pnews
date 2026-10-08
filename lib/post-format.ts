import { escapeHtml } from "./telegram.js";
import { sanitizePostText } from "./text.js";
import type { PostMode } from "./select.js";

export const CHANNEL_PUBLIC_URL = "https://t.me/PolozNewss";
export const CHANNEL_CTA_LABEL = "P News. Подписаться";
export const BRASIL_CHANNEL_URL = "https://t.me/pbrasilagora";

export function buildNewsCaption(input: {
  title: string;
  summary: string;
  source?: string;
  mode?: PostMode;
  quote?: string | null;
}): string {
  const title = sanitizePostText(input.title);
  const summary = sanitizePostText(input.summary);
  const source = input.source ? sanitizePostText(input.source) : undefined;
  const mode = input.mode ?? "normal";

  const bolt = mode === "important" ? "❗️" : "⚡️";
  const headline = `${bolt} <b>${escapeHtml(title)}</b>`;

  const parts: string[] = [headline, ""];

  if (mode !== "flash" && summary) {
    parts.push(escapeHtml(summary));
    parts.push("");
  }

  if (mode === "important" && input.quote) {
    parts.push(`<blockquote>${escapeHtml(input.quote)}</blockquote>`);
    parts.push("");
  }

  if (source) {
    parts.push(`— ${escapeHtml(source)}`);
    parts.push("");
  }

  parts.push(
    "💬 Комментируйте ниже, что думаете",
    "🔥 Оставьте реакцию на пост",
    `👉 <a href="${CHANNEL_PUBLIC_URL}">${escapeHtml(CHANNEL_CTA_LABEL)}</a>`,
  );

  return parts.join("\n");
}

export function buildDigestCaption(bullets: string[]): string {
  const lines = bullets.map((b) => `• ${escapeHtml(sanitizePostText(b))}`);
  return [
    "🗞 <b>P News — главное за ночь</b>",
    "",
    ...lines,
    "",
    "💬 Комментируйте ниже, что думаете",
    "🔥 Оставьте реакцию на пост",
    `👉 <a href="${CHANNEL_PUBLIC_URL}">${escapeHtml(CHANNEL_CTA_LABEL)}</a>`,
  ].join("\n");
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
    "Коротко и по делу: политика, экономика, технологии, ЧП.",
    "",
    "Формат поста:",
    "⚡️ заголовок",
    "3–4 предложения контекста (кто / что / почему)",
    "— источник",
    "💬 комментарий · 🔥 реакция",
    "",
    "Пишите в комментариях под постами — обсуждение включено.",
    "",
    `Канал: <a href="${CHANNEL_PUBLIC_URL}">@PolozNewss</a>`,
    `Бразилия: <a href="${BRASIL_CHANNEL_URL}">@pbrasilagora</a>`,
  ].join("\n");
}

/**
 * Keep body readable but with enough context (who / what / why).
 * Cut on sentence boundary — never mid-word.
 */
export function shortenSummary(text: string, maxLen = 520): string {
  const clean = sanitizePostText(text).replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= maxLen) {
    return trimToSentences(clean, 4);
  }
  const sliced = clean.slice(0, maxLen);
  const lastStop = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? "),
  );
  if (lastStop > 140) {
    return trimToSentences(sliced.slice(0, lastStop + 1).trim(), 4);
  }
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace > 140) return `${sliced.slice(0, lastSpace).trim()}…`;
  return `${sliced.trim()}…`;
}

function trimToSentences(text: string, maxSentences: number): string {
  const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  return parts.slice(0, maxSentences).join(" ").trim();
}
