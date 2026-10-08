/**
 * Light post-MT cleanup: names, calques, broken machine-Russian.
 * Not a full translator — just stop the worst pass-throughs.
 */
const PHRASE_FIXES: Array<[RegExp, string]> = [
  [/\bНационал-демократы\b/gi, "Демократы"],
  [/\bнационал-демократ(?:ы|ов|ам|ами|ах)?\b/gi, "демократы"],
  [/\bСпар\b/g, "Spar"],
  [/\bТурек\b/g, "Турек"],
  [/\bХинсон\b/g, "Хинсон"],
  [/\bWare Eye\b/gi, "настороженный взгляд"],
  [/\bDrawing Ware Eye\b/gi, "вызывая настороженность"],
  [/\bхриплого митинга\b/gi, "шумного митинга"],
  [/\bглавный пост США\b/gi, "крупную базу США"],
  [/\bвакцинн(?:ым|ых|ые)\s+травм/gi, "поствакцинальн$1 травм"],
  [/\bпо вакцинным травмам\b/gi, "по поствакцинальным осложнениям"],
  [/\bМинздрав США\b/g, "минздрав США"],
  [/\bHHS\b/g, "минздрав США"],
  [/\bFDA\b/g, "FDA"],
  [/\bWhite House\b/g, "Белый дом"],
  [/\bHouse of Representatives\b/gi, "Палата представителей"],
  [/\bSupreme Court\b/gi, "Верховный суд"],
  [/\bNational Democrats\b/gi, "Демократы"],
  [/\bDGA\b/g, "Ассоциация губернаторов-демократов"],
  [/\bmidterms?\b/gi, "промежуточные выборы"],
  [/\bCamp David\b/gi, "Кэмп-Дэвид"],
  [/\bGuantanamo\b/gi, "Гуантанамо"],
  [/\bGuantánamo\b/gi, "Гуантанамо"],
];

const NAME_MAP: Array<[RegExp, string]> = [
  [/\bRFK Jr\.?/gi, "RFK-младший"],
  [/\bRFK-младший\b/g, "RFK-младший"],
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
  [/\bZohran Mamdani\b/gi, "Зохран Мамдани"],
  [/\bMamdani\b/g, "Мамдани"],
  [/\bChrista Pike\b/gi, "Криста Пайк"],
  [/\bKrista Pike\b/gi, "Криста Пайк"],
];

export function polishRussian(text: string): string {
  let out = text;
  for (const [re, to] of NAME_MAP) out = out.replace(re, to);
  for (const [re, to] of PHRASE_FIXES) out = out.replace(re, to);
  out = out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([.!?])\s*([а-яё])/g, (_, p, c) => `${p} ${c.toUpperCase()}`)
    .trim();
  return out;
}
