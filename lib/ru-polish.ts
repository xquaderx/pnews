/**
 * Post-MT cleanup toward natural Russian: names, calques,
 * duplicate sentences, leftover English scraps.
 */

const NAME_MAP: Array<[RegExp, string]> = [
  [/\bRFK Jr\.?/gi, "RFK-младший"],
  [/\bDonald Trump\b/gi, "Дональд Трамп"],
  [/\bTrump\b/g, "Трамп"],
  [/\bJoe Biden\b/gi, "Джо Байден"],
  [/\bBiden\b/g, "Байден"],
  [/\bKamala Harris\b/gi, "Камала Харрис"],
  [/\bJD Vance\b/gi, "Джей Ди Вэнс"],
  [/\bJ\.?\s*D\.?\s*Vance\b/gi, "Джей Ди Вэнс"],
  [/\bElon Musk\b/gi, "Илон Маск"],
  [/\bMusk\b/g, "Маск"],
  [/\bGavin Newsom\b/gi, "Гэвин Ньюсом"],
  [/\bNewsom\b/g, "Ньюсом"],
  [/\bBarack Obama\b/gi, "Барак Обама"],
  [/\bObama\b/g, "Обама"],
  [/\bChrista Pike\b/gi, "Криста Пайк"],
  [/\bKrista Pike\b/gi, "Криста Пайк"],
  [/с\s+Кристои\s+Пайк/gi, "с Кристой Пайк"],
  [/Кристои\s+Пайк/gi, "Кристой Пайк"],
  [/\bKen Paxton\b/gi, "Кен Пэкстон"],
  [/\bPaxton\b/g, "Пэкстон"],
  [/\bHenry Cuellar\b/gi, "Генри Куэльяр"],
  [/\bCuellar\b/g, "Куэльяр"],
  [/\bTwin Cities\b/gi, "Миннеаполиса и Сент-Пола"],
  [/\bISIS\b/g, "ИГИЛ"],
  [/\bISIL\b/g, "ИГИЛ"],
  // Immigration and Customs Enforcement — never «лёд».
  [/\bICE\s+agents?\b/gi, "ICE агент"],
  [/\bICE\s+officers?\b/gi, "ICE офицер"],
  [/\bICE\b/g, "ICE"],
  [/\bZohran\s+Mamdani\b/gi, "Зохран Мамдани"],
  [/\bMamdani\b/g, "Мамдани"],
];

const PHRASE_FIXES: Array<[RegExp, string]> = [
  // ICE mistranslated as weather ice / «ледяной» (Cyrillic-safe, no \b/\w).
  [/ледян(?:ой|ые|ого|ым|ыми)\s+агент(?:ы|ов|а|ом|ами)?/gi, "ICE агент"],
  [/агент(?:ы|ов|ами|а|у|ом)?\s+(?:льда|льду|льдом)/gi, "ICE агент"],
  [/сотрудник(?:и|ов|ами|а|у)?\s+(?:льда|льду|льдом)/gi, "сотрудник ICE"],
  [/застреленн[а-яё]*\s+льдом/gi, "застреленный ICE"],
  [/стреля(?:ет|л|ли)\s+льдом/gi, "стреляет ICE"],
  [/(?<![а-яёА-ЯЁ])льдом(?![а-яёА-ЯЁ])/gi, "ICE"],
  [/(?<![а-яёА-ЯЁ])льда(?![а-яёА-ЯЁ])(?=\s+(?:в\s+Нью|агент|,|\.|$))/gi, "ICE"],
  [/(?<![а-яёА-ЯЁ])ледяной(?![а-яёА-ЯЁ])/gi, "ICE"],
  [/XXICEAGENT(?:S|XX)?/gi, "ICE агент"],
  [/XXICEOFFICER(?:S|XX)?/gi, "ICE офицер"],
  [/XXICEAGENCYXX/gi, "ICE"],
  // Broken MT titles / verbs — before name rewrites.
  [/мужчина посмотрел на .+? за нападение и поклялся в верности ИГИЛ(?:,?\s*сообщает ФБР)?/gi,
    "ФБР: в Миннесоте задержали парня, который готовил нападение на Mall of America и присягнул ИГИЛ"],
  [/посмотрел на (.+?) за нападение/gi, "готовил нападение на $1"],
  [/смотрит на (.+?) за нападение/gi, "готовит нападение на $1"],
  [/cased\s+(.+?)\s+for\s+(?:an\s+)?attack/gi, "готовил нападение на $1"],
  [/eyed\s+(.+?)\s+for\s+(?:an\s+)?attack/gi, "готовил нападение на $1"],
  [/targeted\s+(.+?)\s+for\s+(?:an\s+)?attack/gi, "готовил нападение на $1"],
  [/арестован под дулом пистолета/gi, "задержан вооружёнными агентами"],
  [/был арестован под дулом пистолета/gi, "был задержан вооружёнными агентами"],
  [/торговом центре америка\b/gi, "торговом центре Mall of America"],
  [/торгового центра америка\b/gi, "торгового центра Mall of America"],
  [/в Атлантике\s+сезон/gi, "в атлантическом сезоне"],
  [/Атлантике\s+сезон/gi, "атлантическом сезоне"],
  [/это первый ураган \d{4} года в атлантическом сезоне\.?/gi, ""],
  [/побило исторический рекорд/gi, "стало рекордно поздним"],
  [/сообщает ФБР\s*$/gi, ""],
  [/Национал-демократы/gi, "Демократы"],
  [/хриплого митинга/gi, "шумного митинга"],
  [/гонки шатров штата/gi, "главные гонки штата"],
  [/перепихнулся с/gi, "обрушился на"],
  [/Козырь\b/g, "Трамп"],
  [/\bTruth Social\b/gi, "Truth Social"],
  [/главный пост США/gi, "крупную базу США"],
  [/по вакцинным травмам/gi, "по поствакцинальным осложнениям"],
  [/\bHHS\b/g, "минздрав США"],
  [/\bWhite House\b/g, "Белый дом"],
  [/\bHouse of Representatives\b/gi, "Палата представителей"],
  [/\bSupreme Court\b/gi, "Верховный суд"],
  [/\bCamp David\b/gi, "Кэмп-Дэвид"],
  [/\bGuantanamo\b/gi, "Гуантанамо"],
  [/\bmidterms?\b/gi, "промежуточные выборы"],
  [/федеральному уголовному иску/gi, "федеральному обвинению"],
  [/федеральной уголовной жалобе/gi, "федеральному обвинению"],
  [/уголовному иску, поданному/gi, "обвинению, которое подали"],
  [/во время организованной встречи, чтобы купить/gi, "на контрольной встрече, где он собирался купить"],
  [/штурмовую винтовку/gi, "автомат"],
];

/** Split into sentences (RU/EN punctuation). */
export function splitSentences(text: string): string[] {
  return (text.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) ?? [text])
    .map((s) => s.trim())
    .filter(Boolean);
}

function normTokens(s: string): Set<string> {
  const norm = s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return new Set(norm.split(" ").filter((t) => t.length >= 4));
}

function similarSentence(a: string, b: string): boolean {
  const ta = normTokens(a);
  const tb = normTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = ta.size + tb.size - inter;
  const jaccard = inter / union;
  const containment = inter / Math.min(ta.size, tb.size);
  return jaccard >= 0.55 || containment >= 0.75;
}

/** Drop near-duplicate sentences (RSS+page often repeat the same lead). */
export function dedupeSentences(text: string): string {
  const parts = splitSentences(text);
  const kept: string[] = [];
  for (const s of parts) {
    if (kept.some((k) => similarSentence(k, s))) continue;
    kept.push(s);
  }
  return kept.join(" ").replace(/\s{2,}/g, " ").trim();
}

/** Heuristic: still looks like broken machine Russian. */
export function looksBrokenRussian(text: string): boolean {
  if (/посмотрел на .+ за /i.test(text)) return true;
  if (/\bв Атлантике сезон\b/i.test(text)) return true;
  if (/торговом центре америка/i.test(text)) return true;
  if (/под дулом пистолета/i.test(text)) return true;
  if (/javascript|воспроизвести\s+это\s+видео|видео\s+нельзя\s+проигрывать/i.test(text)) {
    return true;
  }
  if (/смотреть\s*:\s*что\s+мы\s+знаем/i.test(text)) return true;
  if (/ледян(?:ой|ые)\s+агент|застреленн[а-яё]*\s+льдом|(?<![а-яёА-ЯЁ])льдом(?![а-яёА-ЯЁ])/i.test(text)) {
    return true;
  }
  // Too much leftover English in a "Russian" post.
  const cyr = (text.match(/[А-Яа-яЁё]/g) ?? []).length;
  const lat = (text.match(/[A-Za-z]/g) ?? []).length;
  if (cyr > 40 && lat > cyr * 0.35) return true;
  // Dictionary-dump primers stacked
  if ((text.match(/—/g) ?? []).length >= 3) return true;
  return false;
}

export function polishRussian(text: string): string {
  let out = text;
  // Phrase fixes first — they catch broken MT before name rewrites.
  for (const [re, to] of PHRASE_FIXES) out = out.replace(re, to);
  for (const [re, to] of NAME_MAP) out = out.replace(re, to);
  out = dedupeSentences(out);
  out = out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    // Capitalize after sentence end.
    .replace(/([.!?…])\s*([а-яё])/g, (_, p, c: string) => `${p} ${c.toUpperCase()}`)
    .replace(/^(и|а|но)\s+/i, "")
    .trim();
  // Ensure first letter capital.
  if (out && /[а-яёa-z]/.test(out[0]!)) {
    out = out[0]!.toUpperCase() + out.slice(1);
  }
  return out;
}
