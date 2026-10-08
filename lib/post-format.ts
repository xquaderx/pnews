import { escapeHtml } from "./telegram.js";
import { sanitizePostText } from "./text.js";

export const CHANNEL_PUBLIC_URL = "https://t.me/PolozNewss";
export const CHANNEL_CTA_LABEL = "P News. Подписаться";

/** Short Topor-style caption: ⚡ headline + 1–2 sentences + single CTA. */
export function buildNewsCaption(input: {
  title: string;
  summary: string;
}): string {
  const title = sanitizePostText(input.title);
  const summary = sanitizePostText(input.summary);

  const headline = `⚡️ <b>${escapeHtml(title)}</b>`;
  const body = escapeHtml(summary);
  const engage =
    "💬 Комментируйте ниже, что думаете\n" +
    "🔥 Оставьте реакцию на пост";
  const cta =
    `👉 <a href="${CHANNEL_PUBLIC_URL}">${escapeHtml(CHANNEL_CTA_LABEL)}</a>`;

  return [headline, "", body, "", engage, cta].join("\n");
}

/** Keep body to ~1–2 sentences, cut on sentence boundary. */
export function shortenSummary(text: string, maxLen = 280): string {
  const clean = sanitizePostText(text).replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= maxLen) {
    return trimToSentences(clean, 2);
  }
  const sliced = clean.slice(0, maxLen);
  const lastStop = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? "),
    sliced.lastIndexOf(". "),
  );
  if (lastStop > 60) return sliced.slice(0, lastStop + 1).trim();
  // Prefer word boundary over mid-word cut.
  const lastSpace = sliced.lastIndexOf(" ");
  if (lastSpace > 60) return `${sliced.slice(0, lastSpace).trim()}…`;
  return `${sliced.trim()}…`;
}

function trimToSentences(text: string, maxSentences: number): string {
  const parts = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  return parts.slice(0, maxSentences).join(" ").trim();
}
