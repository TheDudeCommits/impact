import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { allowedOrigin, mountEconomy } from '../src/server/economy/api';
import { mountErrorReports } from '../src/server/ops/errorReports';

describe('Player Two: the hosted copy is one of the game\'s own origins', () => {
  it('is let in by default, and no other Player Two origin is', () => {
    expect(allowedOrigin('https://impact.playertwo.cc', [])).toBe(true);
    for (const other of ['https://other.playertwo.cc', 'https://impact.playertwo.cc.evil.example', 'http://impact.playertwo.cc', 'https://playertwo.lol', 'https://x.impact.playertwo.cc'])
      expect([other, allowedOrigin(other, [])]).toEqual([other, false]);
  });

  it('gets the economy\'s answers and a preflight over HTTP', async () => {
    const posts = new Map<string, (req: unknown, res: unknown) => void>(); let gate: ((req: unknown, res: unknown, next: () => void) => void) | undefined;
    const economy = mountEconomy({ use: (_path, handler) => { gate = handler as never; }, post: (path, handler) => { posts.set(path, handler as never); } }, { dir: false });
    const call = (origin: string, method = 'POST') => new Promise<{ status: number; headers: Record<string, string>; body?: Record<string, unknown> }>(resolve => {
      const req = Object.assign(new EventEmitter(), { method, headers: { origin } as Record<string, string> });
      const headers: Record<string, string> = { 'access-control-allow-origin': origin };
      const res = { statusCode: 0, setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; }, removeHeader: (k: string) => { delete headers[k.toLowerCase()]; }, end: (text?: string) => resolve({ status: res.statusCode, headers, body: text ? JSON.parse(text) : undefined }) };
      gate!(req, res, () => { posts.get('/api/economy/hello')!(req, res); queueMicrotask(() => { req.emit('data', Buffer.from('{}')); req.emit('end'); }); });
    });
    const preflight = await call('https://impact.playertwo.cc', 'OPTIONS');
    expect(preflight.status).toBe(204); expect(preflight.headers['access-control-allow-origin']).toBe('https://impact.playertwo.cc');
    expect(preflight.headers['access-control-allow-headers']).toContain('content-type');
    const hello = await call('https://impact.playertwo.cc');
    expect(hello.status).toBe(200); expect(hello.headers['access-control-allow-origin']).toBe('https://impact.playertwo.cc'); expect(hello.body!.token).toMatch(/^[a-f0-9]{32}$/);
    expect((await call('https://other.playertwo.cc', 'OPTIONS')).headers['access-control-allow-origin']).toBeUndefined();
    economy.close();
  });

  it('files the hosted copy\'s error reports', async () => {
    const handlers = new Map<string, (req: unknown, res: unknown) => void>();
    const store = mountErrorReports({ post: (path, handler) => handlers.set(`POST ${path}`, handler as never), get: (path, handler) => handlers.set(`GET ${path}`, handler as never) }, { origins: [], log: () => {} });
    const send = (origin: string, message: string) => new Promise<{ status: number; allow?: string }>(resolve => {
      const req = Object.assign(new EventEmitter(), { method: 'POST', headers: { origin } as Record<string, string>, socket: { remoteAddress: '203.0.113.9' } });
      const headers: Record<string, string> = {};
      const res = { statusCode: 0, setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; }, removeHeader: (k: string) => { delete headers[k.toLowerCase()]; }, end: () => resolve({ status: res.statusCode, allow: headers['access-control-allow-origin'] }) };
      handlers.get('POST /errors')!(req, res);
      queueMicrotask(() => { req.emit('data', Buffer.from(JSON.stringify({ kind: 'error', message, build: '0123456789ab', path: '/', screen: 'home', browser: 'Chrome 141 / macOS', tab: 'abc123def0' }))); req.emit('end'); });
    });
    const hosted = await send('https://impact.playertwo.cc', 'TypeError: from the hosted copy');
    expect(hosted.status).toBe(204); expect(hosted.allow).toBe('https://impact.playertwo.cc'); expect(store.groups.size).toBe(1);
    await send('https://other.playertwo.cc', 'TypeError: from another game');
    expect(store.groups.size).toBe(1);
  });
});
