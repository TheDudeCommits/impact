import type { Account, Settlement } from '../../game/economy/account';
import type { ItemKind } from '../../game/economy/catalog';
import type { Report } from '../../game/economy/earn';

export interface ShopConfig { privy?: string }
export interface Wallet {
  account?: Account;
  signedIn?: boolean;
  sold: Record<string, number>;
  config: ShopConfig;
  live: boolean;
}
export interface Redeemed { says: string; allAccess: boolean; items: string[]; sumi: number }
interface Answer { account: Account; signedIn?: boolean; sold: Record<string, number>; config: ShopConfig; token?: string; settlement?: Settlement; redeemed?: Redeemed }

export class Refused extends Error { need?: string }
export type Poster = (path: string, body: unknown) => Promise<{ status: number; body: unknown }>;
export interface Store { get(key: string): string | undefined; set(key: string, value: string | undefined): void }

const KEY = { token: 'jump-account-token', account: 'jump-account', pending: 'jump-account-pending', login: 'jump-account-login' } as const;
const isSession = (token: string | undefined) => !!token?.startsWith('s_');

export function maskEmail(email: string): string {
  const [name = '', domain = ''] = email.trim().split('@'), parts = domain.split('.'), end = parts.length > 1 ? parts.pop()! : '';
  return `${Array.from(name)[0] ?? ''}•••@${Array.from(parts.join('.'))[0] ?? ''}•••${end ? `.${end}` : ''}`;
}
const KEEP = 12, GAP = 9;

const env = (typeof import.meta !== 'undefined' ? (import.meta as { env?: Record<string, string | undefined> }).env : undefined) ?? {};
export const economyServer = () => (env.VITE_ECONOMY_SERVER || env.VITE_MATCH_SERVER || `${location.protocol === 'https:' ? 'https' : 'http'}://${location.hostname}:2567`).replace(/^ws/, 'http').replace(/\/+$/, '');

const httpPost: Poster = async (path, body) => {
  const response = await fetch(`${economyServer()}/api/economy/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  let json: unknown;
  try { json = await response.json(); } catch { json = undefined; }
  return { status: response.status, body: json };
};
const browserStore = (): Store => ({
  get: key => { try { return localStorage.getItem(key) ?? undefined; } catch { return undefined; } },
  set: (key, value) => { try { if (value === undefined) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { } },
});

const LONGEST = 300;

export class AccountClient {
  wallet: Wallet = { sold: {}, config: {}, live: false };
  private token?: string;
  private readonly listeners = new Set<(wallet: Wallet) => void>();
  private chain: Promise<unknown> = Promise.resolve();
  private flushing?: Promise<void>;

  constructor(private readonly post: Poster = httpPost, private readonly store: Store = browserStore(), private readonly wait = (seconds: number) => new Promise<void>(done => setTimeout(done, seconds * 1000))) {
    this.token = store.get(KEY.token);
    try { const kept = JSON.parse(store.get(KEY.account) ?? 'null') as { account?: Account; config?: ShopConfig; signedIn?: boolean } | null; if (kept?.account && this.token) this.wallet = { ...this.wallet, account: kept.account, signedIn: kept.signedIn ?? isSession(this.token), config: { privy: kept.config?.privy } }; } catch { }
  }

  on(listener: (wallet: Wallet) => void) { this.listeners.add(listener); listener(this.wallet); return () => { this.listeners.delete(listener); }; }
  private emit() { for (const listener of this.listeners) listener(this.wallet); }
  get account() { return this.wallet.account; }
  get known() { return !!this.token; }
  secret() { return this.token; }
  get login() { return this.wallet.signedIn ? this.store.get(KEY.login) : undefined; }

  private take(answer: Answer) {
    if (answer.token) { this.token = answer.token; this.store.set(KEY.token, answer.token); }
    this.wallet = { account: answer.account, signedIn: answer.signedIn ?? isSession(this.token), sold: answer.sold ?? {}, config: { privy: answer.config?.privy }, live: true };
    this.store.set(KEY.account, JSON.stringify({ account: answer.account, config: this.wallet.config, signedIn: this.wallet.signedIn }));
    this.emit();
    return answer;
  }
  private async ask(path: string, body: Record<string, unknown>, again = true): Promise<Answer> {
    const { status, body: json } = await this.post(path, { ...body, token: this.token });
    const answer = json as (Answer & { error?: string }) | undefined;
    if (status === 200 && answer?.account) return this.take(answer);
    if (status === 401 && again && path !== 'hello') { await this.ask('hello', {}, false); return this.ask(path, body, false); }
    if (status === 429) throw Object.assign(new Refused(answer?.error ?? 'Too soon.'), { later: true });
    if (status >= 400 && status < 500) throw Object.assign(new Refused(answer?.error ?? 'The server said no.'), { need: (answer as { need?: string } | undefined)?.need });
    throw new Error(answer?.error ?? `The server answered ${status}.`);
  }
  private queued<T>(work: () => Promise<T>): Promise<T> {
    const run = this.chain.then(work, work);
    this.chain = run.catch(() => undefined);
    return run;
  }

  start() { return this.queued(async () => { if (this.token) await this.ask('hello', {}); }).then(() => { void this.flush(); }, () => undefined); }
  open() { return this.queued(async () => { if (!this.token || !this.wallet.live) await this.ask('hello', {}); return this.wallet; }); }

  async report(report: Report): Promise<{ settlement?: Settlement; kept?: boolean; later?: string; refused?: string }> {
    try { return { settlement: (await this.queued(async () => { if (!this.token) await this.ask('hello', {}); return this.ask('report', { report }); })).settlement }; }
    catch (error) {
      if (error instanceof Refused && !(error as { later?: boolean }).later) return { refused: error.message };
      this.keep(report);
      if (error instanceof Refused) { void this.flush(); return { kept: true, later: error.message }; }
      return { kept: true };
    }
  }
  private pending(): Report[] { try { const list = JSON.parse(this.store.get(KEY.pending) ?? '[]') as Report[]; return Array.isArray(list) ? list : []; } catch { return []; } }
  private keep(report: Report) { const list = this.pending().filter(each => each.id !== report.id); this.store.set(KEY.pending, JSON.stringify([...list, report].slice(-KEEP))); }
  flush(): Promise<void> {
    return this.flushing ??= (async () => {
      try {
        for (let list = this.pending(), waits = 0; list.length; list = this.pending()) {
          const [next] = list;
          try { await this.queued(async () => { if (!this.token) await this.ask('hello', {}); return this.ask('report', { report: next }); }); }
          catch (error) { if (!(error instanceof Refused)) return; if ((error as { later?: boolean }).later) { await this.wait(Math.min(LONGEST, GAP * 2 ** waits++)); continue; } }
          waits = 0;
          this.store.set(KEY.pending, JSON.stringify(this.pending().filter(each => each.id !== next.id)));
          if (this.pending().length) await this.wait(GAP);
        }
      } finally { this.flushing = undefined; }
    })();
  }

  buy(item: string) { return this.queued(() => this.ask('buy', { item })); }
  wear(kind: ItemKind, item: string | undefined) { return this.queued(() => this.ask('wear', { kind, item })); }
  async redeem(code: string, identity?: string): Promise<Redeemed> {
    return (await this.queued(() => this.ask('redeem', { code, ...(identity ? { identity } : {}) }, false))).redeemed!;
  }
  claimName(name: string) { return this.queued(() => this.ask('name', { name }, false)); }
  signIn(access: string, shown?: string) { return this.queued(async () => { const answer = await this.ask('signin', { access }, false); this.store.set(KEY.login, shown); this.emit(); return answer; }); }
  signInPlayerTwo(identity: string, shown?: string) { return this.queued(async () => { const answer = await this.ask('p2-signin', { identity }, false); this.store.set(KEY.login, shown); this.emit(); return answer; }); }
  async linkCode(identity: string): Promise<string> {
    const answer = await this.queued(() => this.ask('p2-link-code', { identity }, false)) as Answer & { code?: string };
    if (!answer.code) throw new Refused('The server gave no code. Try again.');
    return answer.code;
  }
  signOut(): Promise<void> {
    return this.queued(async () => { this.store.set(KEY.login, undefined); try { await this.ask('signout', {}, false); } catch { this.forget(); } });
  }
  deleteAccount(): Promise<void> {
    return this.queued(async () => {
      if (this.token) {
        const { status, body } = await this.post('delete', { token: this.token, confirm: 'DELETE' });
        const answer = body as (Partial<Answer> & { deleted?: boolean; error?: string }) | undefined;
        if (status === 404) throw new Refused('This server cannot delete accounts yet. Email Hello@Dude.work and it will be done for you.');
        if (status !== 200 || !answer?.deleted) throw status >= 400 && status < 500 ? new Refused(answer?.error ?? 'The server said no.') : new Error(answer?.error ?? `The server answered ${status}.`);
        this.store.set(KEY.pending, undefined);
        this.forget();
        if (answer.account && answer.token) this.take(answer as Answer);
      } else this.forget();
    });
  }
  private forget() {
    this.token = undefined;
    this.store.set(KEY.token, undefined); this.store.set(KEY.account, undefined); this.store.set(KEY.login, undefined);
    this.wallet = { sold: this.wallet.sold, config: this.wallet.config, live: false };
    this.emit();
  }
}

export const account = new AccountClient();
