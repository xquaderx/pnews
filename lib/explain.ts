/**
 * Extra background for readers who don't follow US news.
 * Primers are short and only added when the story needs them.
 */

type Primer = { re: RegExp; text: string };

// Avoid JS \b with Cyrillic — it breaks Russian matching.
const PRIMERS: Primer[] = [
  {
    re: /(tropical storm|hurricane|ураган|тропический шторм|тропического шторма)/i,
    text: "Тропический шторм / ураган — мощный циклон у берегов США: сильный ветер, ливни и риск наводнений на побережье Мексиканского залива и Атлантики.",
  },
  {
    re: /(Guantanamo|Гуантанамо|9\/11|11 сентября)/i,
    text: "Гуантанамо — военная тюрьма США на Кубе. Там с начала 2000-х держат людей, которых власти США связывают с терактами 11 сентября 2001 года и войной с террором.",
  },
  {
    re: /(special counsel|специальн\w+\s+прокурор|Letitia James|Летици\w+\s+Джеймс)/i,
    text: "Специальный прокурор в США — независимый обвинитель по чувствительному делу. Летиция Джеймс — генпрокурор штата Нью-Йорк, известна делами против Трампа.",
  },
  {
    re: /(midterm|промежуточн\w+\s+выбор|House of Representatives|Палат\w+\s+представител)/i,
    text: "Промежуточные выборы в США — голосование в Конгресс в середине президентского срока; от них зависит, сможет ли партия президента проводить законы.",
  },
  {
    re: /(FDA|мифепристон|mifepristone)/i,
    text: "FDA — американский регулятор лекарств и продуктов. Мифепристон — препарат для медикаментозного прерывания беременности; споры о нём идут в судах и политике США.",
  },
  {
    re: /(Starlink|SpaceX)/i,
    text: "Starlink — спутниковый интернет компании SpaceX Илона Маска; запуск в новых странах часто упирается в разрешения властей и местных операторов связи.",
  },
  {
    re: /(governor|губернатор|gubernatorial)/i,
    text: "Губернатор в США — глава штата (как президент, но на уровне штата): отвечает за бюджет, законы штата и чрезвычайные ситуации.",
  },
  {
    re: /(White House|Белый дом|\bTrump\b|Трамп)/i,
    text: "Белый дом — резиденция и аппарат президента США. Сейчас президент — Дональд Трамп.",
  },
  {
    re: /(Senate|Сенат|senator|сенатор)/i,
    text: "Сенат — верхняя палата Конгресса США: 100 сенаторов, по двое от каждого штата; без Сената не принимают федеральные законы.",
  },
  {
    re: /(mortgage|ипотек|Federal Reserve|ФРС|inflation|инфляц)/i,
    text: "Ипотечные ставки и инфляция в США сильно влияют на цены жилья и повседневные расходы; ключевую роль играет Федеральная резервная система (ФРС).",
  },
];

/** Titles that are weather products / maps, not explainable news. */
export function isThinProductTitle(title: string): boolean {
  return (
    /(graphic|graphics|watches?\/warnings?|outlook|discussion|public advisory)/i.test(
      title,
    ) ||
    /(график[аи]|карта предупрежд|часы\/карта|Key Messages)/i.test(title) ||
    /^NHC\b/i.test(title)
  );
}

/** Reject body that still doesn't explain the story to a newcomer. */
export function isExplainableBody(title: string, summary: string): boolean {
  if (isThinProductTitle(title)) return false;
  const s = summary.replace(/\s+/g, " ").trim();
  if (s.length < 200) return false;
  const sentences = (s.match(/[.!?…]/g) ?? []).length;
  if (sentences < 3) return false;
  const hasWhoWhat =
    /(это|который|которая|президент|губернатор|сенатор|судья|компани|власт|обвиня|ураган|шторм|суд|Конгресс|Белый дом|тюрм|штат|выбор)/i.test(
      s,
    ) ||
    /\b(president|governor|senator|judge|company|charged|hurricane|storm|court|Congress|prison|state)\b/i.test(
      s,
    );
  return hasWhoWhat;
}

/**
 * Prepend 1–2 short primers if the story touches a US-specific concept
 * and the explainer isn't already in the text.
 */
export function withOutsiderContext(title: string, summary: string): string {
  const blob = `${title}\n${summary}`;
  const extras: string[] = [];
  for (const p of PRIMERS) {
    if (!p.re.test(blob)) continue;
    // Skip if a distinctive chunk of the primer is already present.
    const marker = p.text.split(/[—.]/)[0]?.trim().toLowerCase() ?? "";
    if (marker.length >= 6 && summary.toLowerCase().includes(marker)) {
      // Still add if primer has a definition the summary lacks (em dash explainer).
      if (summary.includes("—") || summary.includes("–")) continue;
    }
    extras.push(p.text);
    if (extras.length >= 2) break;
  }
  if (extras.length === 0) return summary;
  return `${extras.join(" ")} ${summary}`.replace(/\s+/g, " ").trim();
}
