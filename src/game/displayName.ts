export const NAME_FALLBACK = 'Fighter';

const COMPOSED = /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}]/u;
const MARK = /\p{M}/u, LETTER = /\p{L}/u, READ = /[\p{L}\p{N}]/u, SPACE = /[\p{Zs}\t\n\r\u2028\u2029]/u;
const BLANK = /[\u115F\u1160\u3164\uFFA0]/u;
const QUOTE = /[\u2018\u2019\u02BC\u0060\u00B4]/u, DASH = /[\u2010-\u2015\u2212]/u;
const PUNCTUATION = /[-_.']/u, UNDRAWN = /[\p{C}<>]/u;

export function tidyName(raw: unknown, max = 20, strict = false): string {
  let out = '', marks = -1, space = false;
  for (const each of String(raw ?? '').slice(0, 160).normalize('NFKC')) {
    if (MARK.test(each)) { if (marks >= 0 && marks < 2) { out += each; marks++; } continue; }
    marks = -1;
    if (BLANK.test(each)) continue;
    if (SPACE.test(each)) { space = out.length > 0; continue; }
    const char = QUOTE.test(each) ? '\'' : DASH.test(each) ? '-' : each;
    if (!READ.test(char) && (strict ? !PUNCTUATION.test(char) : UNDRAWN.test(char))) continue;
    if (space) { out += ' '; space = false; }
    out += char;
    if (LETTER.test(char) && !COMPOSED.test(char)) marks = 0;
  }
  const name = [...out].slice(0, max).join('').trimEnd();
  return READ.test(name) ? name : NAME_FALLBACK;
}
