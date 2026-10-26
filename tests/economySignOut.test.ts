import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { AccountClient, type Poster, type Store } from '../src/ui/shop/account';
import { signInFlow } from '../src/ui/shop/signin';
import type { PrivyBridge } from '../src/ui/shop/privy';
import { Economy } from '../src/server/economy/api';

const memory = (): Store & { data: Map<string, string> } => { const data = new Map<string, string>(); return { data, get: key => data.get(key), set: (key, value) => { if (value === undefined) data.delete(key); else data.set(key, value); } }; };
const settle = () => new Promise(done => setTimeout(done, 0));

function privyKeys(appId: string) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
  const fetcher = (async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })) as unknown as typeof fetch;
  const token = (did: string) => {
    const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const head = `${part({ alg: 'ES256', typ: 'JWT', kid: 'k1' })}.${part({ iss: 'privy.io', aud: appId, sub: did, exp: Math.floor(Date.now() / 1000) + 600 })}`;
    return `${head}.${crypto.sign('sha256', Buffer.from(head), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  };
  return { fetcher, token };
}

function wire(economy: Economy) {
  const state = { down: false };
  const post: Poster = async (path, body) => {
    if (state.down) throw new Error('offline');
    const b = body as Record<string, unknown>;
    try {
      const answer = path === 'hello' ? economy.hello(b.token) : path === 'signin' ? await economy.signIn(b.token, b.access)
        : path === 'signout' ? economy.signOut(b.token) : path === 'buy' ? economy.buy(b.token, b.item) : undefined;
      return { status: 200, body: JSON.parse(JSON.stringify(answer)) };
    } catch (error) { return { status: (error as { status?: number }).status ?? 400, body: { error: (error as Error).message } }; }
  };
  return { post, state };
}

function stubPrivy(token: (did: string) => string, shown = 'as o•••@e•••.com') {
  const state = { session: undefined as string | undefined, account: 'did:privy:owner1', modals: 0, logouts: 0, load: 'works' as 'works' | 'fails' | 'hangs', logout: 'works' as 'works' | 'hangs' };
  const bridge: PrivyBridge = {
    async login(options = {}) {
      if (state.session && !options.fresh) return { token: token(state.session), shown };
      state.modals++; state.session = state.account;
      return { token: token(state.session), shown };
    },
    async resume() { if (!state.session) throw new Error('cancelled'); return { token: token(state.session), shown }; },
    logout() { state.logouts++; if (state.logout === 'hangs') return new Promise<void>(() => {}); state.session = undefined; return Promise.resolve(); },
    async identity() { return { token: null }; },
  };
  const load = () => state.load === 'works' ? Promise.resolve(bridge) : state.load === 'fails' ? Promise.reject(new Error('Sign-in did not load.')) : new Promise<PrivyBridge>(() => {});
  return { state, load };
}

function browserOn(economy: Economy, privy: ReturnType<typeof stubPrivy>, wired = wire(economy)) {
  const local = memory(), session = memory(), at = { href: 'https://impact.dude.work/' };
  const page = () => {
    const account = new AccountClient(wired.post, local, async () => {});
    const flow = signInFlow({ account, privy: privy.load, local, session, href: () => at.href, replace: url => { at.href = new URL(url, at.href).href; } });
    return { account, flow };
  };
  return { local, session, at, page, wired };
}

describe('signing out', () => {
  it('turns the page into a guest at once, stays out across a reload, and never signs itself back in', async () => {
    const keys = privyKeys('app-one'), economy = new Economy({ dir: false, privyAppId: 'app-one', fetcher: keys.fetcher });
    const privy = stubPrivy(keys.token), browser = browserOn(economy, privy);
    let { account, flow } = browser.page();
    await account.open();
    await flow.signIn();
    const login = account.account!, session = account.secret()!;
    expect(account.wallet.signedIn).toBe(true); expect(account.login).toBe('as o•••@e•••.com'); expect(login.label).toBeUndefined(); expect(session).toMatch(/^s_/); expect(privy.state.modals).toBe(1);

    await flow.signOut();
    expect(account.wallet.signedIn).toBe(false); expect(account.account!.pk).not.toBe(login.pk);
    expect(account.secret()).not.toBe(session);
    expect(economy.book.find(session)).toBeUndefined();
    expect(economy.book.byLogin('did:privy:owner1')?.pk).toBe(login.pk);
    await settle();
    expect(privy.state.logouts).toBe(1); expect(privy.state.session).toBeUndefined();

    ({ account, flow } = browser.page());
    expect(account.wallet.signedIn).toBe(false);
    await account.start();
    expect(await flow.finishSignIn()).toBe(false);
    expect(account.wallet.live).toBe(true); expect(account.wallet.signedIn).toBe(false);
    expect(economy.book.hasLogin(economy.book.find(account.secret())!.pk)).toBe(false); expect(account.login).toBeUndefined();

    await flow.signIn();
    expect(privy.state.modals).toBe(2); expect(account.account!.pk).toBe(login.pk);
    economy.close();
  });

  it('signs out even when Privy cannot: a slow island, a failed one, a logout that never returns', async () => {
    const keys = privyKeys('app-one'), economy = new Economy({ dir: false, privyAppId: 'app-one', fetcher: keys.fetcher });
    for (const trouble of [{ load: 'hangs' }, { load: 'fails' }, { logout: 'hangs' }] as const) {
      const privy = stubPrivy(keys.token), browser = browserOn(economy, privy), { account, flow } = browser.page();
      await account.open(); await flow.signIn();
      Object.assign(privy.state, trouble);
      await flow.signOut();
      expect(account.wallet.signedIn, JSON.stringify(trouble)).toBe(false);
      privy.state.load = 'works'; privy.state.logout = 'works';
      const modals = privy.state.modals;
      await flow.signIn();
      expect(privy.state.modals, JSON.stringify(trouble)).toBe(modals + 1);
      expect(account.wallet.signedIn).toBe(true);
    }
    economy.close();
  });

  it('signs out when the server cannot be reached: the browser forgets the session, and is a guest when it can', async () => {
    const keys = privyKeys('app-one'), economy = new Economy({ dir: false, privyAppId: 'app-one', fetcher: keys.fetcher });
    const privy = stubPrivy(keys.token), browser = browserOn(economy, privy), { account, flow } = browser.page();
    await account.open(); await flow.signIn();
    const login = account.account!.pk;
    browser.wired.state.down = true;
    await flow.signOut();
    expect(account.secret()).toBeUndefined(); expect(account.account).toBeUndefined();
    expect(browser.local.get('jump-account-token')).toBeUndefined(); expect(browser.local.get('jump-account')).toBeUndefined();
    browser.wired.state.down = false;
    await account.open();
    expect(account.wallet.signedIn).toBe(false); expect(account.account!.pk).not.toBe(login);
    economy.close();
  });

  it('still takes up a Privy session without the modal where nobody signed out', async () => {
    const keys = privyKeys('app-one'), economy = new Economy({ dir: false, privyAppId: 'app-one', fetcher: keys.fetcher });
    const privy = stubPrivy(keys.token);
    privy.state.session = 'did:privy:owner1';
    const { account, flow } = browserOn(economy, privy).page();
    await account.open(); await flow.signIn();
    expect(privy.state.modals).toBe(0); expect(account.wallet.signedIn).toBe(true);
    economy.close();
  });

  it('finishes a sign-in that went to a provider, and only one this tab started', async () => {
    const keys = privyKeys('app-one'), economy = new Economy({ dir: false, privyAppId: 'app-one', fetcher: keys.fetcher });
    const privy = stubPrivy(keys.token), browser = browserOn(economy, privy);
    let { account, flow } = browser.page();
    await account.open();
    browser.local.set('jump-signed-out', '1');
    browser.session.set('jump-signin', String(Date.now()));
    privy.state.session = 'did:privy:owner1';
    browser.at.href = 'https://impact.dude.work/?privy_oauth_code=c&privy_oauth_state=s&privy_oauth_provider=google#home';
    ({ account, flow } = browser.page());
    await account.start();
    expect(await flow.finishSignIn()).toBe(true);
    expect(account.wallet.signedIn).toBe(true); expect(browser.at.href).toBe('https://impact.dude.work/#home');
    expect(browser.local.get('jump-signed-out')).toBeUndefined();
    await flow.signOut(); await settle();
    privy.state.session = 'did:privy:owner1';
    browser.at.href = 'https://impact.dude.work/?privy_oauth_code=c&privy_oauth_state=s&privy_oauth_provider=google';
    ({ account, flow } = browser.page());
    await account.start();
    expect(await flow.finishSignIn()).toBe(false);
    expect(account.wallet.signedIn).toBe(false); expect(browser.at.href).toBe('https://impact.dude.work/');
    economy.close();
  });
});
