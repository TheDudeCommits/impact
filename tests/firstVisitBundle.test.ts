import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function staticClosure(entry: string) {
  const seen = new Set<string>(), queue = [path.resolve(entry)];
  const resolve = (from: string, spec: string) => {
    if (!spec.startsWith('.')) return spec;
    const base = path.resolve(path.dirname(from), spec);
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, path.join(base, 'index.ts')]) if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    return base;
  };
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.(ts|tsx|js|mjs)$/.test(file) || !fs.existsSync(file)) continue;
    const code = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    for (const m of code.matchAll(/(?:^|[;\n])\s*(import|export)\s+(type\s+)?(?:[\w${},*\s]+?\s+from\s+)?['"]([^'"]+)['"]/g)) {
      if (m[2]) continue;
      queue.push(resolve(file, m[3]));
    }
  }
  return seen;
}

describe('the first visit downloads only what the home screen needs', () => {
  const closure = [...staticClosure('src/main.ts')].map(f => path.relative(process.cwd(), f));

  it('finds the page and the fighter code it does need (the walk works)', () => {
    expect(closure).toContain('src/render/Fighter.ts');
    expect(closure).toContain('three');
  });

  it('leaves Rapier out of it', () => {
    expect(closure.filter(f => /rapier3d|game[\\/]rapierCollision/.test(f))).toEqual([]);
  });

  it("leaves the fighters' own effects modules to the rooms that have them", () => {
    const set = fs.readFileSync('src/render/signature/RosterSignatureSet.ts', 'utf8');
    const lazy = [...set.matchAll(/lazy\(\(\) => import\('([^']+)'\)/g)].map(m => path.relative(process.cwd(), path.resolve('src/render/signature', m[1])) + '.ts');
    expect(lazy.length).toBeGreaterThanOrEqual(29);
    expect(lazy.filter(file => closure.includes(file))).toEqual([]);
  });
});
