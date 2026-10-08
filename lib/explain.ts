/**
 * Rare background only for truly opaque US terms.
 * No textbook lines about things already clear from the story
 * (death penalty, "what is a governor", etc.).
 */

type Primer = { re: RegExp; clause: string };

/** Only acronyms / institutions that a casual RU reader may not know. */
const PRIMERS: Primer[] = [
  {
    re: /(Guantanamo|Гуантанамо)/i,
    clause:
      "Гуантанамо — военная тюрьма США на Кубе для обвиняемых по делам о терроризме.",
  },
  {
    re: /\bFDA\b/,
    clause: "FDA — американский регулятор лекарств и продуктов.",
  },
  {
    re: /(Federal Reserve|\bФРС\b)/i,
    clause:
      "ФРС — центральный банк США; её ставки влияют на кредиты и цены.",
  },
  {
    re: /\bHHS\b/,
    clause: "HHS — минздрав США.",
  },
];

export function isThinProductTitle(title: string): boolean {
  return (
    /(graphic|graphics|watches?\/warnings?|outlook|discussion|public advisory)/i.test(
      title,
    ) ||
    /(график[аи]|карта предупрежд|часы\/карта|Key Messages)/i.test(title) ||
    /^NHC\b/i.test(title)
  );
}

export function isExplainableBody(title: string, summary: string): boolean {
  if (isThinProductTitle(title)) return false;
  const s = summary.replace(/\s+/g, " ").trim();
  if (s.length < 160) return false;
  const sentences = (s.match(/[.!?…]/g) ?? []).length;
  if (sentences < 2) return false;
  if (sentences < 3 && s.length < 260) return false;
  return /(это|который|которая|президент|губернатор|сенатор|судья|компани|власт|обвиня|ураган|шторм|суд|Конгресс|Белый дом|тюрм|штат|выбор|казн|ФБР|ФРС|арест|задерж|адвокат)/i.test(
    s,
  );
}

/**
 * Add at most one short clause, and only for opaque acronyms/places.
 * Skip when the story already has enough concrete detail.
 */
export function withOutsiderContext(title: string, summary: string): string {
  const blob = `${title}\n${summary}`;
  // If the news itself is already clear — do not pad.
  if (summary.length >= 220 && (summary.match(/[.!?…]/g) ?? []).length >= 2) {
    return summary;
  }
  for (const p of PRIMERS) {
    if (!p.re.test(blob)) continue;
    const marker = p.clause.slice(0, 16).toLowerCase();
    if (summary.toLowerCase().includes(marker)) continue;
    // Only inject if the acronym/place appears but is not explained nearby.
    const m = summary.match(/^(.+?[.!?…])\s+([\s\S]+)$/);
    if (m) {
      return `${m[1]} ${p.clause} ${m[2]}`.replace(/\s+/g, " ").trim();
    }
    return `${p.clause} ${summary}`.replace(/\s+/g, " ").trim();
  }
  return summary;
}
