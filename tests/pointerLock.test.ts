import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(file);
    return /\.(ts|js)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [file] : [];
  });
}

describe('pointer lock on a browser without it (iPhone Safari)', () => {
  it('never calls document.exitPointerLock without the optional call', () => {
    const bare = sources('src').flatMap(file => fs.readFileSync(file, 'utf8').split('\n').flatMap((line, i) => /exitPointerLock\(\)/.test(line) ? [`${file}:${i + 1}`] : []));
    expect(bare).toEqual([]);
  });
});
