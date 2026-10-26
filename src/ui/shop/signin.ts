import type { PrivyBridge, PrivyLogin } from './privy';
import { account as browserAccount, type AccountClient, type Store } from './account';

export interface SignInDeps {
  account: Pick<AccountClient, 'wallet' | 'open' | 'signIn' | 'signOut' | 'deleteAccount'>;
  privy: (appId: string) => Promise<PrivyBridge>;
  session: Store;
  local: Store;
  href: () => string;
  replace: (url: string) => void;
}

const MARK = 'jump-signin', OUT = 'jump-signed-out', OAUTH = ['privy_oauth_code', 'privy_oauth_state', 'privy_oauth_provider'];

export function signInFlow(deps: SignInDeps) {
  const appId = () => deps.account.wallet.config.privy;
  const signedOut = () => !!deps.local.get(OUT);
  async function adopt(login: PrivyLogin) { await deps.account.signIn(login.token, login.shown); deps.local.set(OUT, undefined); }
  function clean() {
    const url = new URL(deps.href()), keys = [...url.searchParams.keys()].filter(key => key.startsWith('privy_'));
    if (!keys.length) return;
    for (const key of keys) url.searchParams.delete(key);
    deps.replace(`${url.pathname}${url.search}${url.hash}`);
  }

  return {
    signedOut,
    async signIn() {
      const id = appId();
      if (!id) throw new Error('Sign-in is not set up yet.');
      deps.session.set(MARK, String(Date.now()));
      await adopt(await (await deps.privy(id)).login({ fresh: signedOut() }));
      deps.session.set(MARK, undefined);
    },
    async signOut() {
      const id = appId();
      deps.local.set(OUT, String(Date.now()));
      await deps.account.signOut();
      if (id) void deps.privy(id).then(bridge => bridge.logout()).catch(() => undefined);
    },
    async deleteAccount() {
      const id = appId(), was = !!deps.account.wallet.signedIn;
      await deps.account.deleteAccount();
      if (!was) return;
      deps.local.set(OUT, String(Date.now()));
      if (id) void deps.privy(id).then(bridge => bridge.logout()).catch(() => undefined);
    },
    async identity(): Promise<string | null> {
      const id = appId();
      if (!id) throw new Error('Sign-in is not set up yet.');
      return (await (await deps.privy(id)).identity()).token;
    },
    async finishSignIn(): Promise<boolean> {
      const query = new URL(deps.href()).searchParams;
      if (!OAUTH.some(key => query.has(key))) return false;
      const at = Number(deps.session.get(MARK) ?? 0);
      deps.session.set(MARK, undefined);
      try {
        if (!at || Date.now() - at > 30 * 60000 || !OAUTH.every(key => query.has(key))) return false;
        await deps.account.open();
        const id = appId();
        if (!id) return false;
        await adopt(await (await deps.privy(id)).resume());
        return true;
      } finally { clean(); }
    },
  };
}

let chunk: Promise<typeof import('./privy')> | null = null;
let bridge: Promise<PrivyBridge> | null = null;
const privyModule = () => (chunk ??= import('./privy').catch(error => { chunk = null; throw error; }));
function load(appId: string): Promise<PrivyBridge> {
  bridge ??= privyModule().then(module => Promise.race([module.mount(appId),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Sign-in did not load. Check your connection and try again.')), 20000))]))
    .catch(error => { bridge = null; throw error; });
  return bridge;
}
const storage = (which: () => globalThis.Storage): Store => ({
  get: key => { try { return which().getItem(key) ?? undefined; } catch { return undefined; } },
  set: (key, value) => { try { if (value === undefined) which().removeItem(key); else which().setItem(key, value); } catch { } },
});

const flow = signInFlow({
  account: browserAccount, privy: load,
  session: storage(() => sessionStorage), local: storage(() => localStorage),
  href: () => location.href, replace: url => history.replaceState(history.state, '', url),
});
export const signIn = flow.signIn;
export const signOut = flow.signOut;
export const finishSignIn = flow.finishSignIn;
export const identity = flow.identity;
export const deleteAccount = flow.deleteAccount;
