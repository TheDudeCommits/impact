import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NOTICE_LINES, NOTICE_VERSION, noticeDue, noticeHtml } from '../src/ui/firstVisit';
import { CONTACT, CREDITS_PAGE, PRIVACY_PAGE, REPO_PAGE } from '../src/ui/legalLinks';

describe('the first-visit notice', () => {
  it('says what the owner asked it to say, with the address a takedown goes to', () => {
    const html = noticeHtml();
    expect(html).toContain('purely a fan game');
    expect(html).toContain('lovers of anime and manga');
    expect(html).toContain('open source');
    expect(html).toMatch(/no monetization whatsoever, and it never will/);
    expect(html).toContain(`mailto:${CONTACT}`);
    expect(html).toContain(NOTICE_LINES.promise);
    expect(html).toMatch(/not affiliated with/);
  });

  it('carries its three ways out: legal and privacy, the credits, the repository, each in a new tab', () => {
    const html = noticeHtml(), links = [...html.matchAll(/<a class="first-visit-link" href="([^"]+)" target="_blank" rel="noopener"/g)].map(m => m[1]);
    expect(links).toEqual([PRIVACY_PAGE, CREDITS_PAGE, REPO_PAGE]);
    expect(REPO_PAGE).toMatch(/^https:\/\/github\.com\//);
    expect(html).toContain('LEGAL &amp; PRIVACY');
    expect(html).toMatch(/class="first-visit-go"/);
  });

  it('shows once per browser, and never to an automated one unless it is asked for', () => {
    expect(noticeDue({ seen: null, webdriver: false, forced: false })).toBe(true);
    expect(noticeDue({ seen: NOTICE_VERSION, webdriver: false, forced: false })).toBe(false);
    expect(noticeDue({ seen: '0', webdriver: false, forced: false })).toBe(true);
    expect(noticeDue({ seen: null, webdriver: true, forced: false })).toBe(false);
    expect(noticeDue({ seen: NOTICE_VERSION, webdriver: true, forced: true })).toBe(true);
  });

  it('is mounted by the page, and the page it calls legal and privacy says what the notice says', () => {
    expect(readFileSync('src/main.ts', 'utf8')).toMatch(/mountFirstVisit\(\)/);
    const page = readFileSync('public/privacy.html', 'utf8');
    expect(page).toContain('<h1>Legal &amp; Privacy</h1>');
    expect(page).toContain(`mailto:${CONTACT}`);
    expect(page).toContain(REPO_PAGE);
    expect(page).toMatch(/no monetization/);
  });
});
