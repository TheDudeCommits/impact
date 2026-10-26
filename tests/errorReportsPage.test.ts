import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { ErrorReporter, NOTICE_SEEN_KEY, REPORTS_PER_TAB, describe as describeError, noise, reportStartFailure, savedChoice, type ReporterHost } from '../src/boot/errorReports';
import { loadSettings } from '../src/config';
import { ERROR_REPORTS_NOTE, homeOptions } from '../src/ui/HomePanels';
import { pauseMenu } from '../src/ui/PauseMenu';
import { NOTICE_KEY } from '../src/ui/firstVisit';
import { recover, whenUnrecovered } from '../src/loading/staleBuild';
import { KEEP_DAYS } from '../src/server/ops/errorReports';

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7390.54 Mobile Safari/537.36';
function page(over: Partial<ReporterHost> & { store?: Record<string, string> } = {}) {
  const store: Record<string, string> = over.store ?? { [NOTICE_SEEN_KEY]: '2' }, sent: { url: string; body: Record<string, unknown>; raw: string }[] = [];
  const host: ReporterHost = { send: (url, raw) => { sent.push({ url, raw, body: JSON.parse(raw) }); }, read: key => store[key] ?? null, agent: ANDROID, path: () => '/', build: '0123456789ab', server: () => 'https://match.example', automated: false, ...over };
  return { reporter: new ErrorReporter(host, 'tab0000001'), sent, store };
}
const boom = (message: string, frame = 'loadStage') => Object.assign(new TypeError(message), { stack: `TypeError: ${message}\n    at ${frame} (https://impact.dude.work/assets/index-D3fK2aB1.js:1:23456)` });

describe('error reports: the player\'s choice', () => {
  afterEach(() => { delete (globalThis as { localStorage?: Storage }).localStorage; });
  const saved = (value: object) => { (globalThis as { localStorage?: unknown }).localStorage = { getItem: () => JSON.stringify(value) }; };

  it('is SEND ERROR REPORTS in Settings, on until the player turns it off', () => {
    expect(loadSettings().errorReports).toBe(true);
    saved({ errorReports: false }); expect(loadSettings().errorReports).toBe(false);
    saved({ errorReports: 'no' }); expect(loadSettings().errorReports).toBe(true);
    expect(savedChoice(null)).toBe(true); expect(savedChoice('{"errorReports":false}')).toBe(false); expect(savedChoice('{"errorReports":true}')).toBe(true); expect(savedChoice('not json')).toBe(true);
  });

  it('stands in both menus, with its line of why under it, and the Settings handler keeps it', () => {
    for (const settings of [{ ...loadSettings(), errorReports: true }, { ...loadSettings(), errorReports: false }]) {
      for (const [markup, hook, label] of [[homeOptions(settings), 'data-home-setting="errorReports"', 'SEND ERROR REPORTS'], [pauseMenu(settings), 'data-setting="errorReports"', 'Send error reports']] as const) {
        const input = new RegExp(`<input [^>]*${hook} type="checkbox" ?(checked)?>`).exec(markup);
        expect(input, hook).toBeTruthy(); expect(!!input![1]).toBe(settings.errorReports);
        expect(markup).toContain(`<span>${label}<small class="option-note">${ERROR_REPORTS_NOTE}</small></span>`);
      }
    }
    expect(ERROR_REPORTS_NOTE.length).toBeLessThanOrEqual(90);
    expect(readFileSync('src/ui/Hud.ts', 'utf8')).toMatch(/key==='errorReports'\)this\.settings\.errorReports=\(input as HTMLInputElement\)\.checked/);
    expect(readFileSync('src/main.ts', 'utf8')).toMatch(/errorReports\.lend\(\{enabled:\(\)=>settings\.errorReports!==false/);
  });

  it('sends nothing when it is off, and reads it at every report', () => {
    let on = false;
    const { reporter, sent } = page();
    reporter.lend({ enabled: () => on });
    expect(reporter.report('error', boom('one'))).toBe('off');
    on = true;
    expect(reporter.report('error', boom('one'))).toBe('sent');
    on = false;
    expect(reporter.report('error', boom('two'))).toBe('off');
    expect(sent).toHaveLength(1);
    const saved = page({ store: { [NOTICE_SEEN_KEY]: '2', 'rift-settings': '{"errorReports":false}' } });
    expect(saved.reporter.report('error', boom('one'))).toBe('off'); expect(saved.sent).toHaveLength(0);
  });
});

describe('error reports: when the page sends', () => {
  it('waits for the first-visit notice to have been seen once, and then sends what waited', () => {
    expect(NOTICE_SEEN_KEY).toBe(NOTICE_KEY);
    const { reporter, sent } = page({ store: {} });
    expect(reporter.noticeSeen()).toBe(false);
    expect(reporter.report('error', boom('before the notice'))).toBe('held');
    expect(sent).toHaveLength(0);
    reporter.noticeRead();
    expect(sent).toHaveLength(1); expect(sent[0].body.message).toBe('TypeError: before the notice');
    expect(reporter.report('error', boom('after it'))).toBe('sent');
    const off = page({ store: {} }); let on = true; off.reporter.lend({ enabled: () => on });
    off.reporter.report('error', boom('held')); on = false; off.reporter.noticeRead();
    expect(off.sent).toHaveLength(0);
  });

  it('sends at most REPORTS_PER_TAB a tab, and each signature once', () => {
    const { reporter, sent } = page();
    expect(reporter.report('error', boom('index 3 out of range'))).toBe('sent');
    expect(reporter.report('error', boom('index 9 out of range'))).toBe('seen');
    for (let i = 1; i < REPORTS_PER_TAB; i++) expect(reporter.report('error', boom('distinct', `frame${'x'.repeat(i)}`))).toBe('sent');
    expect(reporter.report('rejection', boom('one more'))).toBe('full');
    expect(sent).toHaveLength(REPORTS_PER_TAB);
    expect(new Set(sent.map(each => each.url))).toEqual(new Set(['https://match.example/errors']));
  });

  it('never sends from an automated browser, nor what is not the game\'s', () => {
    const robot = page({ automated: true });
    expect(robot.reporter.report('error', boom('x'))).toBe('off');
    const { reporter, sent } = page();
    expect(reporter.report('error', 'ResizeObserver loop completed with undelivered notifications.')).toBe('noise');
    expect(reporter.report('error', 'Script error.')).toBe('noise');
    expect(reporter.report('error', Object.assign(new Error('x'), { stack: 'Error: x\n    at y (chrome-extension://abcdefghijklmnop/content.js:1:1)' }))).toBe('noise');
    expect(reporter.report('error', new Error('x'), undefined, 'moz-extension://id/script.js')).toBe('noise');
    expect(sent).toHaveLength(0);
    expect(noise('TypeError: real', 'at f (https://impact.dude.work/assets/index-D3fK2aB1.js:1:1)')).toBe(false);
  });

  it('takes the player out of a report before it goes: their name, tokens, query strings; the browser by family only', () => {
    const { reporter, sent } = page({ path: () => '/index.html' });
    reporter.lend({ names: () => ['ShadowKing'], screen: () => 'royale' });
    const token = 'ab12'.repeat(8);
    reporter.report('rejection', boom(`ShadowKing's account ${token} failed at https://impact.dude.work/?invite=482913&name=ShadowKing`));
    const { body, raw } = sent[0];
    expect(body).toEqual({ kind: 'rejection', message: 'TypeError: <name>\'s account <hex> failed at https://impact.dude.work/', stack: expect.any(String), build: '0123456789ab', path: '/index.html', screen: 'royale', browser: 'Chrome 141 / Android', tab: 'tab0000001' });
    expect(raw).not.toMatch(/ShadowKing|482913|Mozilla|Pixel 8/); expect(raw).not.toContain(token);
    expect(describeError('plain words')).toEqual({ message: 'plain words' });
    expect(describeError({ type: 'error' })).toEqual({ message: 'Object: error' });
    expect(describeError({ message: 'shaped like an error', name: 'AbortError' })).toEqual({ message: 'AbortError: shaped like an error', stack: undefined });
    expect(describeError(42)).toEqual({ message: '42' });
    expect(describeError(null)).toEqual({ message: 'null' });
  });

  it('reports a context lost on screen, not one a hidden page gave up', () => {
    const { reporter, sent } = page(), listeners: (() => void)[] = [];
    let hidden = true;
    reporter.watchCanvas({ addEventListener: (type: string, listener: () => void) => { if (type === 'webglcontextlost') listeners.push(listener); } } as never, () => hidden);
    listeners[0](); expect(sent).toHaveLength(0);
    hidden = false; listeners[0]();
    expect(sent.map(each => each.body.kind)).toEqual(['webgl']);
  });

  it('reports a start that failed in the code, not one refused in words, nor a chunk staleBuild is curing', async () => {
    expect(reportStartFailure(new Error('Enter the 6-digit room code.'))).toBeUndefined();
    expect(reportStartFailure(new TypeError('Failed to fetch dynamically imported module: https://impact.dude.work/assets/x.js'))).toBeUndefined();
    expect(reportStartFailure(new TypeError('Cannot read properties of undefined'))).toBe('off');
    const told: unknown[] = [];
    whenUnrecovered(error => told.push(error));
    const chunk = new TypeError('Failed to fetch dynamically imported module: https://impact.dude.work/assets/x.js');
    expect(await recover(chunk)).toBe(false); expect(told).toEqual([chunk]);
    expect(await recover(new Error('something else'))).toBe(false); expect(told).toHaveLength(1);
  });
});

describe('error reports: what the page bundle may hold', () => {
  it('uses no regular-expression lookbehind, which Safari before 16.4 cannot parse (the whole bundle would fail there)', () => {
    for (const file of ['src/game/errorReport.ts', 'src/boot/errorReports.ts']) expect(readFileSync(file, 'utf8'), file).not.toMatch(/\(\?<[=!]/);
  });
});

describe('error reports: the privacy page', () => {
  it('says what a report holds and never holds, how long it is kept, and where it is turned off, in the toggle\'s own words', () => {
    const page = readFileSync('public/privacy.html', 'utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    expect(page).toContain('Error reports are sent by the game itself when something breaks');
    expect(page).toContain('One goes only to our own game server, no other company.');
    expect(page).toContain('It never holds your IP address, your account or its token, your username or the name you play under, or your email address');
    expect(page).toContain(`kept for ${KEEP_DAYS} days, then deleted, and are used only to find and fix what broke`);
    expect(page).toContain('OPTIONS → SEND ERROR REPORTS');
    expect(page).toContain('and how many error reports it may send');
    expect(homeOptions(loadSettings())).toContain('SEND ERROR REPORTS');
  });
});
