/** National relevance + post mode heuristics. */

export type PostMode = "flash" | "normal" | "important";

/**
 * Live blogs / multi-topic "Updates:" roundups — skip.
 * They produce vague titles and torn mid-sentence bodies.
 */
export function isLiveBlogOrRoundupTitle(title: string): boolean {
  const t = title.trim();
  if (
    /^(updates?|live\s*updates?|обновлени[яе]|смотрите\s+прямую|watch\s+live)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  // "Updates: A; B, C in focus" mashups
  if (
    /обновлен|updates?/i.test(t) &&
    (t.includes(";") || /,.*,/.test(t))
  ) {
    return true;
  }
  // Two topics glued with ";" — almost always a live-blog roundup.
  if (t.includes(";") && t.split(";").filter((p) => p.trim().length > 8).length >= 2) {
    return true;
  }
  if (/в центре внимания дебат/i.test(t)) return true;
  return false;
}

/** Soft-clean leftover live-blog prefixes if a title slipped through. */
export function cleanHeadline(title: string): string {
  return title
    .replace(
      /^(updates?|live\s*updates?|обновлени[яе])\s*[:\-–—]\s*/i,
      "",
    )
    .replace(/^(смотрите\s+прямую\s+трансляцию|watch\s+live)\s*:?\s*/i, "")
    .trim();
}

const NATIONAL_FIGURES =
  /\b(Trump|Biden|Harris|Vance|Obama|Newsom|Musk|RFK|Congress|Senate|White House|Supreme Court|FBI|CIA|Pentagon|FDA|HHS|Fed|Federal Reserve|SpaceX|Nvidia|Apple|Tesla|Hurricane|Wildfire)\b/i;

const NATIONAL_FIGURES_RU =
  /\b(Трамп|Байден|Харрис|Вэнс|Обама|Ньюсом|Маск|Конгресс|Сенат|Белый дом|Верховный суд|ФБР|ЦРУ|Пентагон|ФРС|ураган|лесн\w+\s+пожар)/i;

const LOCAL_NOISE =
  /\b(high school|school board|city council|county fair|youth league|little league|zoning board|local police blotter)\b/i;

const LOCAL_RACE =
  /\b(governor(?:'s)? race|senate race|house race|primary in|special election in)\b/i;

const STATE_WITHOUT_NATIONAL =
  /\b(Iowa|Wyoming|Montana|Idaho|Alaska|Vermont|Delaware|Rhode Island|North Dakota|South Dakota)\b/i;

/** Drop small local / state-only stories without national hooks. */
export function isNationalEnough(title: string, summary: string): boolean {
  const blob = `${title}\n${summary}`;
  if (LOCAL_NOISE.test(blob)) return false;

  if (NATIONAL_FIGURES.test(blob) || NATIONAL_FIGURES_RU.test(blob)) {
    return true;
  }

  // State races / debate roundups without a national figure → skip.
  if (
    (LOCAL_RACE.test(blob) || /\b(\d+)\s+takeaways?\b/i.test(blob) || /\b\d+\s+вывода\b/i.test(blob)) &&
    STATE_WITHOUT_NATIONAL.test(blob) &&
    !NATIONAL_FIGURES.test(blob) &&
    !NATIONAL_FIGURES_RU.test(blob)
  ) {
    return false;
  }
  // Generic "N takeaways" from state governor debates — low value for national feed.
  if (
    /\b(governor(?:'s)? debate|gubernatorial)\b/i.test(blob) &&
    !NATIONAL_FIGURES.test(blob) &&
    !/\b(Trump|Biden|Harris|Vance)\b/i.test(blob)
  ) {
    return false;
  }

  // Economy / tech / disaster / crime with US framing stay.
  if (
    /\b(mortgage|inflation|recession|GDP|stocks?|Nasdaq|Dow|layoff|hurricane|earthquake|wildfire|shooting|indicted|sentenced|FDA|CDC)\b/i.test(
      blob,
    )
  ) {
    return true;
  }

  // Default: keep general US politics feeds, drop obviously local.
  if (/\b(mayor of|sheriff|school district|town of)\b/i.test(blob)) {
    return false;
  }
  return true;
}

export function detectPostMode(input: {
  title: string;
  summary: string;
}): PostMode {
  const blob = `${input.title}\n${input.summary}`;
  // Never use "flash" (headline-only) — readers need full context.
  if (
    /\b(impeach|assassin|nuclear|invasion|declare(?:s|d)? war|mass shooting|supreme court rules|emergency)\b/i.test(
      blob,
    ) ||
    /\b(импичмент|ядерн|объявил войну|массовое убийство|чрезвычайн)\b/i.test(
      blob,
    )
  ) {
    return "important";
  }
  return "normal";
}

/** Pull a spoken quote for blockquote if present. */
export function extractQuote(text: string): string | null {
  const m =
    text.match(/[«"]([^«»"]{20,220})[»"]/) ??
    text.match(/“([^”]{20,220})”/) ??
    text.match(/"([^"]{20,220})"/);
  if (!m?.[1]) return null;
  const q = m[1].trim();
  if (q.split(/\s+/).length < 4) return null;
  return q;
}
