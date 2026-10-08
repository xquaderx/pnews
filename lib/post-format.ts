import { escapeHtml } from "./telegram.js";
import { looksLikeUiJunk, sanitizePostText } from "./text.js";
import type { FeedKind } from "./rss.js";
import { cleanHeadline, type PostMode } from "./select.js";

export const CHANNEL_PUBLIC_URL = "https://t.me/PolozNewss";
export const CHANNEL_HANDLE = "@PolozNewss";
export const CHANNEL_CTA_LABEL = "P News. Подписаться";
export const BRASIL_CHANNEL_URL = "https://t.me/pbrasilagora";

/** Soft target for body; final fit always keeps CTA inside 1024. */
export const BODY_MAX_LEN = 720;
export const BODY_MAX_SENTENCES = 6;
export const MAX_PIN_PARAGRAPHS = 5;

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

/** Topic hashtag like the competitor channel (#общество / #политика / …). */
export function topicHashtag(
  kind?: FeedKind,
  title = "",
  summary = "",
): string {
  const blob = `${title}\n${summary}`;
  if (
    kind === "economy" ||
    /\b(экономик|инфляц|акци|бирж|ставк|ФРС|ипотек|безработиц)/i.test(blob)
  ) {
    return "#экономика";
  }
  if (
    kind === "tech" ||
    /\b(технолог|ИИ|искусственн\w+\s+интеллект|Apple|Google|Tesla|SpaceX|чип)/i.test(
      blob,
    )
  ) {
    return "#технологии";
  }
  if (
    kind === "weather" ||
    /\b(ураган|шторм|торнадо|наводнен|лесн\w+\s+пожар|землетрясен)/i.test(blob)
  ) {
    return "#погода";
  }
  if (
    kind === "crime" ||
    /\b(убийств|расстрел|арест|тюрм|казн|суд|приговор|обвиня)/i.test(blob)
  ) {
    return "#общество";
  }
  if (
    kind === "politics" ||
    /\b(Конгресс|Сенат|Белый дом|Трамп|выбор|губернатор|сенатор|импичмент)/i.test(
      blob,
    )
  ) {
    return "#политика";
  }
  return "#общество";
}

/** Split a lead into 📍 paragraphs (1–2 sentences each). */
export function toPinParagraphs(
  text: string,
  maxPins = MAX_PIN_PARAGRAPHS,
): string[] {
  const clean = dropTornFragments(text);
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [];
  const pins: string[] = [];
  let buf = "";
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (!buf) {
      buf = s;
      continue;
    }
    // Pack short lead sentences together; start a new pin when buffer is meaty.
    if (buf.length < 110 && buf.split(/\s+/).length < 16) {
      buf = `${buf} ${s}`;
      continue;
    }
    pins.push(buf);
    buf = s;
    if (pins.length >= maxPins) {
      buf = "";
      break;
    }
  }
  if (buf && pins.length < maxPins) pins.push(buf);
  // Drop torn / scraped-UI pins (video JS chrome, headline mash, etc.).
  return pins
    .filter((p) => !looksTornText(p) && !looksLikeUiJunk(p))
    .slice(0, maxPins);
}

function removeQuoteFromBody(body: string, quote: string): string {
  if (!quote) return body;
  const q = quote.trim();
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return body
    .replace(/[«"]\s*[^«»"]{10,240}\s*[»"]/g, (m) =>
      m.includes(q.slice(0, 24)) ? " " : m,
    )
    .replace(/“\s*[^”]{10,240}\s*”/g, (m) =>
      m.includes(q.slice(0, 24)) ? " " : m,
    )
    // Attribution + quote in one clause → drop the whole clause chunk.
    .replace(
      new RegExp(
        `(?:по\\s+словам|сказал[аи]?|говорит)\\s+[^.!?…]{0,60}?${escaped}[.!?…]?`,
        "gi",
      ),
      " ",
    )
    // Bare phrase after we pulled it into <blockquote>
    .replace(new RegExp(escaped, "gi"), " ")
    .replace(/\s*;\s*/g, ". ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/,\s*\./g, ".")
    .replace(/\.\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildNewsCaption(input: {
  title: string;
  summary: string;
  /** Kept for callers; never shown in the channel caption. */
  source?: string;
  kind?: FeedKind;
  mode?: PostMode;
  quote?: string | null;
}): string {
  const title = cleanHeadline(sanitizePostText(input.title));
  const mode = input.mode ?? "normal";
  // Competitor style: bold title only (❗️ only for truly important).
  const prefix = mode === "important" ? "❗️ " : "";
  const headline = `${prefix}<b>${escapeHtml(title)}</b>`;
  const footer = footerBlock();
  const tag = topicHashtag(input.kind, title, input.summary);

  let quote =
    input.quote && input.quote.trim().length >= 20
      ? sanitizePostText(input.quote)
      : "";
  let summary = sanitizePostText(
    quote ? removeQuoteFromBody(input.summary, quote) : input.summary,
  );

  for (let i = 0; i < 10; i++) {
    const pins = toPinParagraphs(summary, Math.max(2, MAX_PIN_PARAGRAPHS - Math.floor(i / 2)));
    const pinLines = pins.map((p) => `📍 ${escapeHtml(p)}`);
    const parts: string[] = [headline, ""];
    if (pinLines.length) {
      // Insert quote after the first pin when we have one (competitor mid-post quote).
      if (quote && pinLines.length >= 2) {
        parts.push(pinLines[0]!);
        parts.push(`<blockquote>${escapeHtml(quote)}</blockquote>`);
        parts.push(...pinLines.slice(1));
      } else {
        parts.push(...pinLines);
        if (quote) {
          parts.push(`<blockquote>${escapeHtml(quote)}</blockquote>`);
        }
      }
      parts.push("");
    }
    parts.push(tag, "", footer);
    const caption = parts.join("\n");
    if (caption.length <= 1024) return caption;

    const overflow = caption.length - 1024;
    if (quote.length > 40) {
      quote = shortenSummary(quote, Math.max(40, quote.length - overflow - 20), 2);
      continue;
    }
    if (summary.length > 100) {
      summary = shortenSummary(
        summary,
        Math.max(100, summary.length - overflow - 24),
        Math.max(2, BODY_MAX_SENTENCES - i),
      );
      continue;
    }
    quote = "";
    summary = shortenSummary(summary, 100, 2);
  }

  const fallback = [headline, "", tag, "", footer].join("\n");
  if (fallback.length <= 1024) return fallback;
  const shortTitle = escapeHtml(title).slice(0, 180);
  return [`${prefix}<b>${shortTitle}</b>`, "", tag, "", footer]
    .join("\n")
    .slice(0, 1024);
}

export function buildDigestCaption(bullets: string[]): string {
  const lines = bullets.map((b) => `📍 ${escapeHtml(sanitizePostText(b))}`);
  const footer = footerBlock();
  let body = lines.join("\n");
  let caption = [
    "<b>P News — главное за ночь</b>",
    "",
    body,
    "",
    "#общество",
    "",
    footer,
  ].join("\n");
  while (caption.length > 1024 && lines.length > 3) {
    lines.pop();
    body = lines.join("\n");
    caption = [
      "<b>P News — главное за ночь</b>",
      "",
      body,
      "",
      "#общество",
      "",
      footer,
    ].join("\n");
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
    footerBlock(),
  ].join("\n");
}

export function buildPinText(): string {
  return [
    "🇺🇸 <b>P News — новости из США</b>",
    "",
    "Коротко и по делу: заголовок, факты по пунктам, без воды и без чужих брендов.",
    "",
    "Формат поста:",
    "жирный заголовок",
    "📍 факты по абзацам",
    "комментарии под постом",
    "",
    `Канал: <a href="${CHANNEL_PUBLIC_URL}">${escapeHtml(CHANNEL_HANDLE)}</a>`,
    `Бразилия: <a href="${BRASIL_CHANNEL_URL}">@pbrasilagora</a>`,
  ].join("\n");
}

/** Drop CMS teasers and mid-thought fragments ("кандидат в Сенат..."). */
export function dropTornFragments(text: string): string {
  const clean = sanitizePostText(text).replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const parts = clean.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) ?? [clean];
  const kept: string[] = [];
  for (const raw of parts) {
    let s = raw.trim();
    if (!s) continue;
    // Ellipsis / "read more" teaser — never ship.
    if (/\.\.\.|…/.test(s)) continue;
    if (looksLikeUiJunk(s)) continue;
    if (/javascript|воспроизвести\s+это\s+видео|смотреть\s*:/i.test(s)) continue;
    // Must end with real sentence punctuation.
    if (!/[.!?]$/.test(s)) continue;
    // Dangling "who?" stubs.
    if (
      /\b(кандидат(?:а|у|ом)?\s+в\s+Сенат|кандидат(?:а|у|ом)?\s+в\s+губернаторы)\s*[.!?]?$/i.test(
        s,
      )
    ) {
      continue;
    }
    if (/\b(сказал(?:а|и)?|говорит),?\s+что\s+(?:он|она|они)\s*[.!?]?$/i.test(s)) {
      continue;
    }
    kept.push(s);
  }
  return kept.join(" ").replace(/\s{2,}/g, " ").trim();
}

/** True when body still looks cut mid-thought after cleanup. */
export function looksTornText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/\.\.\.|…/.test(t)) return true;
  if (!/[.!?]$/.test(t)) return true;
  if (
    /\b(кандидат(?:а|у|ом)?\s+в\s+Сенат|сказал(?:а|и)?,?\s+что\s+(?:он|она))\s*$/i.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Keep a clear explainer body: only complete sentences, never "…".
 */
export function shortenSummary(
  text: string,
  maxLen = BODY_MAX_LEN,
  maxSentences = BODY_MAX_SENTENCES,
): string {
  const clean = dropTornFragments(text);
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
  // Prefer fewer full sentences over a torn tail — never append "…".
  const shorter = trimToSentences(clean, Math.max(1, maxSentences - 1));
  if (shorter.length <= maxLen && shorter.length > 80) return shorter;
  return trimToSentences(clean, 2);
}

function trimToSentences(text: string, maxSentences: number): string {
  const parts = dropTornFragments(text).match(/[^.!?]+[.!?]+/g) ?? [];
  if (parts.length === 0) return "";
  return parts.slice(0, maxSentences).join(" ").trim();
}
