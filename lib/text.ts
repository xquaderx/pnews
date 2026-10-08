/** Decode HTML/XML entities (including double-encoded &amp;#8220;). */
export function decodeEntities(text: string): string {
  let cur = text;
  for (let i = 0; i < 6; i++) {
    const prev = cur;
    cur = cur
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/gi, " ")
      .replace(/&ldquo;|&laquo;|&#8220;/gi, "“")
      .replace(/&rdquo;|&raquo;|&#8221;/gi, "”")
      .replace(/&lsquo;|&#8216;/gi, "‘")
      .replace(/&rsquo;|&#8217;/gi, "’")
      .replace(/&ndash;|&#8211;/gi, "–")
      .replace(/&mdash;|&#8212;/gi, "—")
      .replace(/&ccedil;/gi, "ç")
      .replace(/&Ccedil;/g, "Ç")
      .replace(/&atilde;/gi, "ã")
      .replace(/&otilde;/gi, "õ")
      .replace(/&aacute;/gi, "á")
      .replace(/&eacute;/gi, "é")
      .replace(/&iacute;/gi, "í")
      .replace(/&oacute;/gi, "ó")
      .replace(/&uacute;/gi, "ú")
      .replace(/&acirc;/gi, "â")
      .replace(/&ecirc;/gi, "ê")
      .replace(/&ocirc;/gi, "ô")
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
        const code = Number.parseInt(h, 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : _;
      })
      .replace(/&#(\d+);/g, (_, n) => {
        const code = Number(n);
        return Number.isFinite(code) ? String.fromCodePoint(code) : _;
      });
    if (cur === prev) break;
  }
  return cur;
}

const OUTLET =
  "fox(?:\\s*news)?|cnn|msnbc|nbc|abc|cbs(?:\\s*news)?|bbc|reuters|ap|bloomberg|politico|the\\s+hill|getty(?:\\s*images)?|associated\\s+press";

/** Remove photo credits / CMS bylines accidentally scraped into the article body. */
export function stripImageCredits(text: string): string {
  return text
    // RU/EN "image source:" blocks ending at Updated/Published timestamps.
    .replace(
      /источник\s+изображени[яй]\s*:\s*.{0,160}?(?:Updated\s+\d+\s+minutes?\s+ago|Published\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}(?:,\s*\d{1,2}:\d{2}\s*(?:BST|GMT|UTC|ET|PT))?)/gi,
      " ",
    )
    .replace(
      /(?:image\s+source|photo(?:\s*credit)?|credit)\s*:\s*.{0,160}?(?:Updated\s+\d+\s+minutes?\s+ago|Published\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}(?:,\s*\d{1,2}:\d{2}\s*(?:BST|GMT|UTC|ET|PT))?)/gi,
      " ",
    )
    .replace(/\b(?:Getty\s*Images|AP\s*Photo|AFP)\b/gi, " ")
    .replace(
      /\bPublished\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}(?:,\s*\d{1,2}:\d{2}\s*(?:BST|GMT|UTC|ET|PT))?/gi,
      " ",
    )
    .replace(/\bUpdated\s+\d+\s+minutes?\s+ago\b/gi, " ")
    .replace(/\bUpdated\s+\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/gi, " ")
    // English CMS byline only when next to photo-credit cues.
    .replace(
      /(?:Getty\s*Images|AP\s*Photo|image\s+source|photo\s+credit)\s+By\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}(?:\s+and\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})?/gi,
      " ",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Remove outlet self-promo / attribution crumbs from titles and bodies. */
export function stripOutletBranding(text: string): string {
  const outlet = OUTLET;
  return stripImageCredits(text)
    .replace(
      new RegExp(
        `^\\s*(first\\s+on\\s+(?:${outlet})\\s*[:\\-–—]\\s*)`,
        "i",
      ),
      "",
    )
    .replace(
      new RegExp(
        `^\\s*((?:в\\s*)?первые\\s+на\\s+(?:канале\\s+)?(?:${outlet})\\s*[:\\-–—]\\s*)`,
        "i",
      ),
      "",
    )
    .replace(
      new RegExp(
        `\\b(first\\s+on\\s+(?:${outlet})\\s*[:\\-–—]\\s*)`,
        "gi",
      ),
      "",
    )
    .replace(
      new RegExp(
        `((?:в\\s*)?первые\\s+на\\s+(?:канале\\s+)?(?:${outlet})\\s*[:\\-–—]\\s*)`,
        "gi",
      ),
      "",
    )
    .replace(
      new RegExp(
        `\\b(exclusive(?:ly)?\\s+(?:to|from)\\s+(?:${outlet})\\b[:\\-–—]?\\s*)`,
        "gi",
      ),
      "",
    )
    .replace(/\b(fox\s*news\s+exclusive\s*[:\-–—]\s*)/gi, "")
    .replace(
      /^\s*(смотрите\s+прямую\s+трансляцию\s*:?\s*|watch\s+live\s*:?\s*)/gi,
      "",
    )
    .replace(/\b(смотрите\s+прямую\s+трансляцию\s*:?\s*)/gi, "")
    .replace(/\b(LIVE(?:\s*NOW)?\s*:?\s*)/gi, "")
    // TV/web reporter teases: "Skyler Henry has more", "У Скайлер Генри есть еще"
    .replace(
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+has\s+more(?:\s+(?:on\s+this|on\s+the\s+story))?\b\.?/gi,
      " ",
    )
    .replace(
      /\b(?:more\s+from|[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+reports?|has\s+the\s+(?:story|latest))\b\.?/gi,
      " ",
    )
    .replace(
      /у\s+[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){0,2}\s+есть\s+ещ[её]\.?/gi,
      " ",
    )
    .replace(
      /(?:подробнее\s+у|ещ[её]\s+у)\s+[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){0,2}\.?/gi,
      " ",
    )
    // Obvious textbook lines — clear from any death-penalty story.
    .replace(
      /в\s+(?:части|ряде|некоторых|отдельных)\s+штатов\s+сша\s+до\s+сих\s+пор\s+есть\s+смертная\s+казнь[^.!?\n]*[.!?]?/gi,
      " ",
    )
    .replace(
      /до\s+сих\s+пор\s+есть\s+смертная\s+казнь(?:\s+через\s+смертельную\s+инъекцию)?[^.!?\n]*[.!?]?/gi,
      " ",
    )
    .replace(
      /обычно\s+делают\s+смертельную\s+инъекцию[^.!?\n]*[.!?]?/gi,
      " ",
    )
    // "по словам … BBC, CBS News" / "according to BBC"
    .replace(
      new RegExp(
        `(?:,\\s*)?(?:по\\s+словам|согласно|как\\s+сообщает|как\\s+пишет)\\s+(?:американского\\s+партнера\\s+)?(?:${outlet})(?:\\s*,\\s*(?:${outlet}))*\\.?`,
        "gi",
      ),
      "",
    )
    .replace(
      new RegExp(
        `(?:,\\s*)?(?:according\\s+to|as\\s+reported\\s+by)\\s+(?:${outlet})(?:\\s*,\\s*(?:${outlet}))*\\.?`,
        "gi",
      ),
      "",
    )
    .replace(
      new RegExp(`\\((?:${outlet})\\)\\s*$`, "gi"),
      "",
    )
    // Trailing outlet tags in titles: "- AP", "— Reuters", "/ BBC"
    .replace(
      new RegExp(
        `\\s*[-–—|/]\\s*(?:${outlet}|associated\\s+press|ассошиэйтед\\s+пресс)\\s*$`,
        "gi",
      ),
      "",
    )
    .replace(
      new RegExp(
        `\\s*[-–—]\\s*<a[^>]*>\\s*(?:${outlet})\\s*</a>\\s*$`,
        "gi",
      ),
      "",
    )
    .replace(/\s+[-–—]\s*AP\s*$/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[:\-–—]\s*/, "")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

/** Remove "read more", site CTAs and scraped UI chrome. */
export function stripReadMoreBoilerplate(text: string): string {
  const cleaned = text
    .replace(
      /\b(ative\s+nossas\s+notifica|quero\s+receber\s+notifica|receber\s+notifica|inscreva-se|assine\s+a\s+newsletter|cadastre-se|clique\s+aqui|acesse\s+aqui|veja\s+também|veja\s+tambem|relacionadas?|publicidade|anúncio|anuncio)\b[\s\S]*$/i,
      "",
    )
    .replace(
      /\b(подписаться|подпишитесь|читайте\s+также|читайте\s+также|реклама|newsletter|sign\s+up|subscribe\s+now)\b[\s\S]*$/i,
      "",
    )
    .replace(
      /\b(leia\s+mais|continue\s+lendo|saiba\s+mais|leia\s+a\s+matéria|leia\s+a\s+materia|ler\s+mais|read\s+more|click\s+here|continue\s+reading)\b[\s\S]*$/i,
      "",
    )
    .replace(
      /\b(the\s+post\s+.+?\s+appeared\s+first\s+on\b[\s\S]*)$/i,
      "",
    )
    .replace(/\bAP\s+Photo\/[^.]*\.?/gi, "")
    .replace(/\b©\s*[^.]*\.?/g, "")
    .replace(/\b(?:class|aria-[a-z]+|aria|svg|href|src|data-[a-z0-9_-]+|role)=["'][^"']*["']/gi, " ")
    .replace(/\b(?:class|aria-[a-z]+|aria|svg|href|src|data-[a-z0-9_-]+|role)=[^\s>"']+/gi, " ")
    .replace(
      /\b(?:rounded|gap|mx|my|px|py|flex|grid|items|justify|w|h|text|bg|border|col|row|sm|md|lg|xl)-[a-z0-9./:[\]%-]+/gi,
      " ",
    )
    .replace(/\]:?-*/g, " ")
    .replace(/["']\s*>/g, " ")
    .replace(/Menu\s*svg/gi, " ")
    .replace(/Abrir notifica[cç][oõ]es/gi, " ")
    .replace(/Você quer ficar por dentro[\s\S]*$/i, "")
    .replace(/Voce quer ficar por dentro[\s\S]*$/i, "")
    .replace(/\(\s*\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–—]?\s*\d{1,2}h\d{0,2}\s*\)/gi, "")
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\s*[-–—]\s*\d{1,2}h\d{0,2}\b/gi, "")
    .replace(/[<>]{1,}/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
  return stripOutletBranding(cleaned);
}

/** True when text looks like scraped UI / CSS, not journalism. */
export function looksLikeUiJunk(text: string): boolean {
  if (/aria-|class=|svg]|rounded-|gap-|flex |items-|justify-/i.test(text)) {
    return true;
  }
  if (/ative nossas notifica|receber notifica|abrir notifica/i.test(text)) {
    return true;
  }
  if ((text.match(/[-:]/g) ?? []).length > 12 && /\b(mx|px|gap|rounded)\b/i.test(text)) {
    return true;
  }
  return false;
}

export function stripHtml(text: string): string {
  return stripReadMoreBoilerplate(
    decodeEntities(text)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/** Final cleanup before publishing to Telegram. */
export function sanitizePostText(text: string): string {
  const cleaned = stripOutletBranding(
    stripReadMoreBoilerplate(
      decodeEntities(text)
        .replace(/\uFFFD/g, "")
        .replace(/https?:\/\/\S+/gi, "")
        .replace(/www\.\S+/gi, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+([,.!?;:])/g, "$1")
        .trim(),
    ),
  );
  return looksLikeUiJunk(cleaned) ? "" : cleaned;
}
