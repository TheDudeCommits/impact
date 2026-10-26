import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { transform } from 'lightningcss';
import { describe, expect, it } from 'vitest';

function css(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) { const p = join(dir, name); if (statSync(p).isDirectory()) { if (name !== 'vendor') css(p, out); } else if (name.endsWith('.css')) out.push(p); }
  return out;
}
describe('backdrop-filter survives the minifier', () => {
  it('no rule writes the unprefixed property before the -webkit- one', () => {
    const bad = css('src').flatMap(p => [...readFileSync(p, 'utf8').matchAll(/(?<![-\w])backdrop-filter:[^;}]*;\s*-webkit-backdrop-filter/g)].map(() => p));
    expect(bad).toEqual([]);
  });
  it("the results card's backdrop is kept for Chrome and Firefox", () => {
    const targets = { chrome: 107 << 16, safari: 16 << 16, firefox: 104 << 16 };
    const out = new TextDecoder().decode(transform({ filename: 'resultsFrame.css', code: readFileSync('src/ui/results/resultsFrame.css'), minify: true, targets }).code);
    const before = out.match(/\.results-frame:before\{[^}]*\}/)?.[0] ?? '';
    expect(before).toMatch(/(?<![-\w])backdrop-filter:saturate/);
  });
});
