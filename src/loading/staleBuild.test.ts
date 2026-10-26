import { describe, expect, it } from 'vitest';
import { buildChanged, entryOf, isChunkError, isMissingAsset, mayReload } from './staleBuild';

describe('a chunk of an older build', () => {
  it("is recognised in Chrome's, Firefox's and Safari's words, and Vite's", () => {
    for (const message of [
      'Failed to fetch dynamically imported module: https://impact.dude.work/assets/rapierCollision-DlR2tQ0b.js',
      'error loading dynamically imported module: https://impact.dude.work/assets/rapierCollision-DlR2tQ0b.js',
      'Importing a module script failed.',
      'Unable to preload CSS for /assets/privy-B3x9.css',
      "'text/html' is not a valid JavaScript MIME type.",
    ]) expect(isChunkError(new TypeError(message)), message).toBe(true);
    expect(isChunkError('Failed to fetch dynamically imported module: /assets/x-12345678.js')).toBe(true);
    expect(isChunkError(new Error('Could not start', { cause: new TypeError('Importing a module script failed.') }))).toBe(true);
  });
  it('is not any other failure', () => {
    for (const error of [new Error('Failed to fetch'), new Error('The arena did not respond. Try again.'), null, undefined, 42, {}]) expect(isChunkError(error)).toBe(false);
  });
});

describe('an asset the live build no longer has', () => {
  it("is a 404 under /assets/, in three's loaders' words or on the response", () => {
    expect(isMissingAsset(new Error('fetch for "https://impact.dude.work/assets/fighters/naruto-v3.glb?v=0a1b2c3d4e5f" responded with 404: '))).toBe(true);
    expect(isMissingAsset(Object.assign(new Error('x'), { response: { status: 404, url: 'https://impact.dude.work/assets/stages/harbor.glb' } }))).toBe(true);
  });
  it('is not a server error, another status or another path', () => {
    expect(isMissingAsset(new Error('fetch for "https://impact.dude.work/assets/fighters/naruto.glb" responded with 500: '))).toBe(false);
    expect(isMissingAsset(new Error('fetch for "https://example.com/api/thing" responded with 404: '))).toBe(false);
    expect(isMissingAsset(Object.assign(new Error('x'), { response: { status: 404, url: 'https://impact.dude.work/api/economy' } }))).toBe(false);
  });
});

describe('which build a page runs', () => {
  const live = '<!doctype html><html><head><title>Impact</title><script type="module" crossorigin src="/assets/index-DuQu_WBh.js"></script><link rel="stylesheet" crossorigin href="/assets/index-Bx1.css"><link rel="preload" href="/asset-versions.json" as="fetch" crossorigin></head><body><div id="app"></div></body></html>';
  it("is the built page's entry script", () => expect(entryOf(live)).toBe('/assets/index-DuQu_WBh.js'));
  it('reads the attributes in any order, and an absolute address as its path', () => {
    expect(entryOf('<script src="https://impact.dude.work/assets/index-AAAAAAAA.js?x=1" crossorigin type=module></script>')).toBe('/assets/index-AAAAAAAA.js');
    expect(entryOf("<script type='module' src='/assets/index-BBBBBBBB.js'></script>")).toBe('/assets/index-BBBBBBBB.js');
  });
  it("is the dev server's client, which never changes, and nothing for a page without one", () => {
    expect(entryOf('<script type="module" src="/@vite/client"></script><script type="module" src="/src/main.ts"></script>')).toBe('/@vite/client');
    expect(entryOf('<script src="/legacy.js"></script><script type="module">inline()</script>')).toBeUndefined();
    expect(entryOf('<h1>Bad Gateway</h1>')).toBeUndefined();
  });
  it('has changed only when both builds are known and differ', () => {
    expect(buildChanged('/assets/index-DuQu_WBh.js', '/assets/index-B2Qo1zC0.js')).toBe(true);
    expect(buildChanged('/assets/index-DuQu_WBh.js', 'https://impact.dude.work/assets/index-DuQu_WBh.js')).toBe(false);
    expect(buildChanged('/assets/index-DuQu_WBh.js', undefined)).toBe(false);
    expect(buildChanged(undefined, '/assets/index-B2Qo1zC0.js')).toBe(false);
  });
});

describe('the reload guard', () => {
  const now = 1_000_000;
  it('lets a build reload once', () => expect(mayReload('/assets/index-A.js', null, now)).toBe(true));
  it('never twice from the same build (the reload brought it back), so it cannot loop', () => {
    expect(mayReload('/assets/index-A.js', { from: '/assets/index-A.js', at: now - 3_600_000 }, now)).toBe(false);
  });
  it('lets the next build reload in its turn, but not within seconds of the last', () => {
    expect(mayReload('/assets/index-B.js', { from: '/assets/index-A.js', at: now - 60_000 }, now)).toBe(true);
    expect(mayReload('/assets/index-B.js', { from: '/assets/index-A.js', at: now - 5_000 }, now)).toBe(false);
  });
  it('never reloads a page whose build it cannot name', () => expect(mayReload(undefined, null, now)).toBe(false));
});
