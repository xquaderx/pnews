/**
 * Light background for readers new to US news.
 * Prefer one short natural clause — never a dictionary dump.
 */

type Primer = { re: RegExp; clause: string };

const PRIMERS: Primer[] = [
  {
    re: /(tropical storm|hurricane|ураган|тропический шторм)/i,
    clause:
      "Ураганы у берегов США несут сильный ветер, ливни и риск наводнений.",
  },
  {
    re: /(Guantanamo|Гуантанамо|11 сентября)/i,
    clause:
      "Гуантанамо — военная тюрьма США на Кубе, где содержат обвиняемых по делам о терроризме.",
  },
  {
    re: /(FDA|мифепристон|mifepristone)/i,
    clause: "FDA — американский регулятор лекарств.",
  },
  {
    re: /(Starlink|SpaceX)/i,
    clause: "Starlink — спутниковый интернет компании SpaceX Илона Маска.",
  },
  {
    re: /(Federal Reserve|ФРС|ипотек|инфляц|повышен\w+\s+ставк)/i,
    clause:
      "ФРС — центральный банк США; её решения по ставкам влияют на кредиты и цены.",
  },
  {
    re: /(Christa Pike|Криста Пайк|смертельн\w+\s+инъекц)/i,
    clause:
      "В части штатов США до сих пор есть смертная казнь через смертельную инъекцию.",
  },
  {
    re: /(FBI|ФБР|Mall of America|ИГИЛ)/i,
    clause:
      "ФБР — федеральная полиция США; Mall of America — крупный торговый центр в Миннесоте.",
  },
  {
    re: /(midterm|промежуточн\w+\s+выбор)/i,
    clause:
      "Промежуточные выборы решают, кто контролирует Конгресс США в середине президентского срока.",
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
  return /(это|который|которая|президент|губернатор|сенатор|судья|компани|власт|обвиня|ураган|шторм|суд|Конгресс|Белый дом|тюрм|штат|выбор|казн|ФБР|ФРС|арест|задерж)/i.test(
    s,
  );
}

/**
 * Add at most one short background sentence, and only if the body
 * does not already explain the concept.
 */
export function withOutsiderContext(title: string, summary: string): string {
  const blob = `${title}\n${summary}`;
  // Already long enough and concrete — don't pad with textbook lines.
  if (summary.length >= 320 && (summary.match(/[.!?…]/g) ?? []).length >= 3) {
    return summary;
  }
  for (const p of PRIMERS) {
    if (!p.re.test(blob)) continue;
    const marker = p.clause.slice(0, 18).toLowerCase();
    if (summary.toLowerCase().includes(marker)) continue;
    // Put primer after first sentence when possible — reads more naturally.
    const m = summary.match(/^(.+?[.!?…])\s+([\s\S]+)$/);
    if (m) {
      return `${m[1]} ${p.clause} ${m[2]}`.replace(/\s+/g, " ").trim();
    }
    return `${p.clause} ${summary}`.replace(/\s+/g, " ").trim();
  }
  return summary;
}
