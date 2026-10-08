/**
 * Extra background for readers who don't follow US news.
 * Primers are short and only added when the story needs them.
 */

type Primer = { re: RegExp; text: string };

const PRIMERS: Primer[] = [
  {
    re: /\b(tropical storm|hurricane|ураган|тропическ\w+\s+шторм)\b/i,
    text: "Тропический шторм / ураган — мощный циклон у берегов США: сильный ветер, ливни и риск наводнений на побережье Мексиканского залива и Атлантики.",
  },
  {
    re: /\b(Guantanamo|Гуантанамо|9\/11|11 сентября)\b/i,
    text: "Гуантанамо — военная тюрьма США на Кубе. Там с начала 2000-х держат людей, которых власти США связывают с терактами 11 сентября 2001 года и войной с террором.",
  },
  {
    re: /\b(special counsel|специальн\w+\s+прокурор|Letitia James|Летици\w+\s+Джеймс)\b/i,
    text: "Специальный прокурор в США — независимый обвинитель по чувствительному делу. Летиция Джеймс — генпрокурор штата Нью-Йорк, известна делами против Трампа.",
  },
  {
    re: /\b(midterm|промежуточн\w+\s+выбор|House of Representatives|Палат\w+\s+представител)\b/i,
    text: "Промежуточные выборы в США — голосование в Конгресс в середине президентского срока; от них зависит, сможет ли партия президента проводить законы.",
  },
  {
    re: /\b(FDA|мифепристон|mifepristone)\b/i,
    text: "FDA — американский регулятор лекарств и продуктов. Мифепристон — препарат для медикаментозного прерывания беременности; споры о нём идут в судах и политике США.",
  },
  {
    re: /\b(Starlink|SpaceX)\b/i,
    text: "Starlink — спутниковый интернет компании SpaceX Илона Маска; запуск в новых странах часто упирается в разрешения властей и местных операторов связи.",
  },
  {
    re: /\b(governor|губернатор|gubernatorial)\b/i,
    text: "Губернатор в США — глава штата (как президент, но на уровне штата): отвечает за бюджет, законы штата и чрезвычайные ситуации.",
  },
  {
    re: /\b(White House|Белый дом|Трамп|Trump)\b/i,
    text: "Белый дом — резиденция и аппарат президента США. Сейчас президент — Дональд Трамп.",
  },
  {
    re: /\b(Senate|Сенат|senator|сенатор)\b/i,
    text: "Сенат — верхняя палата Конгресса США: 100 сенаторов, по двое от каждого штата; без Сената не принимают федеральные законы.",
  },
  {
    re: /\b(mortgage|ипотек|Federal Reserve|ФРС|inflation|инфляц)\b/i,
    text: "Ипотечные ставки и инфляция в США сильно влияют на цены жилья и повседневные расходы; ключевую роль играет Федеральная резервная система (ФРС).",
  },
];

/** Titles that are weather products / maps, not explainable news. */
export function isThinProductTitle(title: string): boolean {
  return (
    /\b(graphic|graphics|watches?\/warnings?|outlook|discussion|public advisory)\b/i.test(
      title,
    ) ||
    /\b(график[аи]|карта|предупреждени[яй]|часы\/карта|outlook)\b/i.test(
      title,
    ) ||
    /^NHC\b/i.test(title) ||
    /\bKey Messages\b/i.test(title)
  );
}

/** Reject body that still doesn't explain the story to a newcomer. */
export function isExplainableBody(title: string, summary: string): boolean {
  if (isThinProductTitle(title)) return false;
  const s = summary.replace(/\s+/g, " ").trim();
  if (s.length < 200) return false;
  const sentences = (s.match(/[.!?…]/g) ?? []).length;
  if (sentences < 3) return false;
  // Cyrillic-friendly cues (avoid JS \b, which breaks on Russian letters).
  const hasWhoWhat =
    /(это|который|которая|президент|губернатор|сенатор|судья|компани|власт|обвиня|ураган|шторм|суд|Конгресс|Белый дом|тюрм|штат|выбор)/i.test(
      s,
    ) ||
    /\b(president|governor|senator|judge|company|charged|hurricane|storm|court|Congress|prison|state)\b/i.test(
      s,
    );
  if (!hasWhoWhat) return false;
  return true;
}

/**
 * Prepend 1 short primer if the story touches a US-specific concept
 * and the primer isn't already reflected in the text.
 */
export function withOutsiderContext(title: string, summary: string): string {
  const blob = `${title}\n${summary}`;
  const extras: string[] = [];
  for (const p of PRIMERS) {
    if (!p.re.test(blob)) continue;
    const key = p.text.slice(0, 40).toLowerCase();
    if (summary.toLowerCase().includes(key.slice(0, 24))) continue;
    extras.push(p.text);
    if (extras.length >= 2) break; // don't drown the news
  }
  if (extras.length === 0) return summary;
  return `${extras.join(" ")} ${summary}`.replace(/\s+/g, " ").trim();
}
