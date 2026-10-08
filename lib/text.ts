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

/** Remove "read more", site CTAs and scraped UI chrome. */
export function stripReadMoreBoilerplate(text: string): string {
  return text
    // Cut from first site CTA / notification prompt onward.
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
    // Tailwind / leftover HTML attribute junk from bad scrapes.
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
  const cleaned = stripReadMoreBoilerplate(
    decodeEntities(text)
      .replace(/\uFFFD/g, "")
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/www\.\S+/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.!?;:])/g, "$1")
      .trim(),
  );
  return looksLikeUiJunk(cleaned) ? "" : cleaned;
}
