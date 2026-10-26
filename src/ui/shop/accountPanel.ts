import './accountPanel.css';
import { CURRENCY, EARNED_LINE } from '../../game/economy/currency';
import { ITEM, ITEMS } from '../../game/economy/catalog';
import { levelOf } from '../../game/economy/earn';
import { owns, type Account } from '../../game/economy/account';
import { NAME_EVERY_DAYS, NAME_MAX, nameFreeAt, nameProblem } from '../../game/economy/names';
import { Refused, type AccountClient, type Redeemed, type Wallet } from './account';

export interface AccountPanelHost {
  attempt(work: () => Promise<void>): Promise<void>;
  say(text: string): void;
}

const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const thousands = (n: number) => Math.floor(n).toLocaleString('en-US');
const COIN = `<b class="shop-coin" aria-hidden="true">${CURRENCY.mark}</b>`;
const RANK_LETTERS = 'FEDCBAS', STYLE_LETTERS = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
const LIVE = ITEMS.filter(item => item.stage === 'live');
const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
export function unlockedLine(got: Redeemed): string {
  const parts = [...got.items.map(id => ITEM.get(id)?.name ?? id), ...(got.sumi ? [`${thousands(got.sumi)} ${CURRENCY.name}`] : [])];
  return parts.length ? `${got.says} (${parts.join(', ')})` : got.says;
}

export function chipName(account: Account | undefined): string {
  return account?.name ? `<i class="shop-chip-name">${escape(account.name)}</i>` : '';
}

export class AccountPanel {
  signIn?: () => Promise<void>;
  signOut?: () => Promise<void>;
  deleteAccount?: () => Promise<void>;
  identity?: () => Promise<string | null>;
  playerTwo?: () => boolean;
  bringOver?: () => Promise<'moved' | 'left'>;
  private deleting = false;
  private redeemed?: Redeemed;
  private readonly emptied = new Set<string>();

  constructor(private readonly client: Pick<AccountClient, 'account' | 'redeem' | 'claimName' | 'login'>, private readonly host: AccountPanelHost) {}

  render(body: HTMLElement, wallet: Wallet) {
    const fields = ['acct-name', 'acct-code'].map(id => body.querySelector<HTMLInputElement>(`#${id}`)).filter((field): field is HTMLInputElement => !!field);
    const kept = fields.map(field => ({ id: field.id, value: field.value, focus: document.activeElement === field, from: field.selectionStart, to: field.selectionEnd }));
    body.innerHTML = this.html(wallet);
    for (const was of kept) {
      const field = body.querySelector<HTMLInputElement>(`#${was.id}`);
      if (!field || field.disabled) continue;
      if (!this.emptied.has(was.id)) field.value = was.value;
      if (was.focus) { field.focus({ preventScroll: true }); if (!this.emptied.has(was.id)) field.setSelectionRange(was.from, was.to); }
    }
    this.emptied.clear();
    for (const form of body.querySelectorAll<HTMLFormElement>('form[data-form]')) form.addEventListener('submit', event => { event.preventDefault(); this.submit(form); });
  }
  html(wallet: Wallet): string {
    const account = wallet.account, privy = wallet.config.privy;
    if (!account) return `<p class="shop-empty">Opening your account…</p>`;
    const level = levelOf(account.xp), stats = account.stats, signedIn = !!wallet.signedIn, shown = this.client.login;
    const cells: [string, string][] = [['RUNS', thousands(stats.runs)], ['MATCHES', thousands(stats.matches)], ['WINS', thousands(stats.wins)], ['ROUNDS CLEARED', thousands(stats.rounds)], ['BOSSES BEATEN', thousands(stats.bosses)],
      ['FINISHERS', thousands(stats.finishers)], ['HORDE CUT DOWN', thousands(stats.kills)], ['RIFTS SEALED', thousands(stats.seals)], ['BEST RANK', stats.runs ? RANK_LETTERS[stats.bestRank] : '–'], ['BEST STYLE', stats.runs ? STYLE_LETTERS[stats.bestStyle] : '–'], ['BEST STREAK', `${stats.bestStreak} D`]];
    const all = account.allAccess ? '<p class="acct-all" title="Everything in the game is yours, and everything added from now on.">ALL ACCESS · NOW AND TO COME</p>' : '';
    const p2 = this.playerTwo?.() ?? false;
    const who = signedIn
      ? `<h3>${escape(account.name ?? 'SIGNED IN')}</h3>${all}<p>Signed in${shown ? ` ${escape(shown)}` : ''}. Your ${CURRENCY.name} and everything you have unlocked are kept with this login, on any device you sign in on.</p>${p2 ? '' : '<button type="button" class="shop-act off" data-act="signout">SIGN OUT</button>'}`
      : p2 ? `<h3>GUEST</h3>${all}<p>This account lives in this browser only: clear its data and it is gone. Sign in to Player Two to keep it, and to carry it to your other devices.</p>`
      : `<h3>GUEST</h3>${all}<p>This account lives in this browser only: clear its data and it is gone. ${privy ? 'Sign in to keep it, and to carry it to your other devices.' : 'Signing in, to keep it and carry it to your other devices, is coming.'}</p>${privy ? '<button type="button" class="shop-act" data-act="signin">SIGN IN</button>' : '<button type="button" class="shop-act" disabled>SIGN IN · SOON</button>'}
        <p class="acct-fine">Sign-in is by email, Google, X or Discord, through Privy. <button type="button" class="acct-link" data-act="privacy">PRIVACY</button></p>`;
    const owned = LIVE.filter(item => owns(account, item.id)).length;
    return `<div class="shop-account">
      <div class="acct-col">
        <section class="shop-who">${who}<small>ACCOUNT ${escape(account.pk)}</small></section>
        ${p2 && signedIn && this.bringOver ? this.bringCard() : ''}
        ${this.nameCard(account, signedIn)}
        ${this.codeCard(signedIn)}
        ${this.dataCard(signedIn)}
      </div>
      <section class="shop-ledger"><h3><span>YOUR ${CURRENCY.name.toUpperCase()}</span></h3>
        <dl><div><dt>${CURRENCY.name.toUpperCase()} NOW</dt><dd>${COIN}${thousands(account.balance)}</dd></div><div><dt>EARNED BY PLAYING</dt><dd>${COIN}${thousands(account.earned)}</dd></div><div><dt>SPENT</dt><dd>${COIN}${thousands(account.spent)}</dd></div>
        <div><dt>ACCOUNT LEVEL</dt><dd>${level.level}</dd></div><div><dt>ITEMS UNLOCKED</dt><dd>${owned} OF ${LIVE.length}</dd></div></dl>
        <p class="shop-note"><b>${EARNED_LINE}</b> Every run and match earns it, and the missions and feats earn more.</p></section>
      <section class="shop-stats"><h3><span>THE RECORD</span></h3><dl>${cells.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl></section>
    </div>`;
  }

  private bringCard(): string {
    return `<section class="acct-card"><h3><span>PLAYED ON IMPACT.DUDE.WORK?</span></h3>
      <p class="shop-note">Bring the account this browser kept there into this one: its ${CURRENCY.name}, items, feats and record join yours, on impact.dude.work and in Player Two alike. A window of impact.dude.work opens and asks first.</p>
      <button type="button" class="shop-act" data-act="p2-bring">BRING IT OVER</button></section>`;
  }

  private nameCard(account: Account, signedIn: boolean): string {
    if (!signedIn) return `<section class="acct-card"><h3><span>USERNAME</span></h3><p class="shop-note">Sign in to claim a username.</p></section>`;
    const freeAt = nameFreeAt(account), waits = freeAt > Date.now(), has = !!account.name;
    const note = waits ? `You can change it again on ${day(freeAt)}. A username can change once every ${NAME_EVERY_DAYS} days.`
      : `Letters, digits and _, ${NAME_MAX} at most; no one else can take it. ${has ? 'Changing it' : 'Claiming it'} starts a ${NAME_EVERY_DAYS}-day wait before the next change.`;
    return `<section class="acct-card"><h3><span>USERNAME</span></h3>
      <form class="acct-form" data-form="name" novalidate>
        <label for="acct-name">${has ? `YOURS: ${escape(account.name!)}` : 'CHOOSE ONE'}</label>
        <div class="acct-row"><input id="acct-name" name="name" maxlength="${NAME_MAX}" placeholder="${has ? 'A new username' : 'Your username'}" autocomplete="off" autocapitalize="off" spellcheck="false"${waits ? ' disabled' : ''}><button type="submit" class="shop-act" data-act="name"${waits ? ' disabled' : ''}>${has ? 'CHANGE' : 'CLAIM'}</button></div>
        <p class="shop-note">${note}</p>
      </form></section>`;
  }

  private codeCard(signedIn: boolean): string {
    if (!signedIn) return `<section class="acct-card"><h3><span>REDEEM A CODE</span></h3><p class="shop-note">Sign in to redeem a code: what it unlocks is kept with your login.</p></section>`;
    return `<section class="acct-card"><h3><span>REDEEM A CODE</span></h3>
      <form class="acct-form" data-form="code" novalidate>
        <label for="acct-code">YOUR CODE</label>
        <div class="acct-row"><input id="acct-code" name="code" maxlength="64" placeholder="Type a code" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="submit" class="shop-act" data-act="redeem">REDEEM</button></div>
        ${this.redeemed ? `<p class="acct-done" role="status">${escape(unlockedLine(this.redeemed))}</p>` : '<p class="shop-note">A code unlocks things for this account. Each code works once per account.</p>'}
      </form></section>`;
  }

  private dataCard(signedIn: boolean): string {
    if (!this.deleting) return `<section class="acct-card acct-data"><h3><span>YOUR DATA</span></h3>
      <p class="shop-note">What the game keeps, and why: <button type="button" class="acct-link" data-act="privacy">THE PRIVACY PAGE</button></p>
      <button type="button" class="acct-delete" data-act="delete">DELETE ACCOUNT</button></section>`;
    return `<section class="acct-card acct-data is-asking" role="alertdialog" aria-labelledby="acct-delete-title" aria-describedby="acct-delete-text"><h3><span id="acct-delete-title">DELETE THIS ACCOUNT?</span></h3>
      <p class="shop-note" id="acct-delete-text">Your ${CURRENCY.name}, items, username and record are erased from the server${signedIn ? ', your login is let go, and this browser is signed out' : ', and this browser starts again as a new guest'}. <b>This cannot be undone.</b></p>
      <div class="acct-row"><button type="button" class="shop-act off" data-act="delete">KEEP MY ACCOUNT</button><button type="button" class="shop-act acct-delete-yes" data-act="delete-yes">DELETE FOR GOOD</button></div></section>`;
  }

  click(button: HTMLElement): boolean {
    const act = button.dataset.act;
    if (act === 'signin') {
      void this.host.attempt(async () => {
        this.host.say('Opening sign-in…');
        await this.signIn?.();
        const shown = this.client.login;
        this.host.say(shown ? `Signed in ${shown}.` : 'Signed in.');
      });
      return true;
    }
    if (act === 'signout') {
      void this.host.attempt(async () => {
        this.host.say('Signing out…');
        await this.signOut?.();
        this.redeemed = undefined;
        this.host.say('Signed out. This device plays as a guest now.');
      });
      return true;
    }
    if (act === 'p2-bring') {
      void this.host.attempt(async () => {
        this.host.say('Opening impact.dude.work…');
        const how = await this.bringOver?.();
        this.host.say(how === 'moved' ? 'Your Impact account is here now.' : 'Nothing was brought over.');
      });
      return true;
    }
    if (act === 'privacy') { window.open('/privacy.html', '_blank', 'noopener'); return true; }
    if (act === 'delete') {
      void this.host.attempt(async () => { this.deleting = !this.deleting; this.host.say(this.deleting ? 'Deleting an account cannot be undone.' : ''); });
      return true;
    }
    if (act === 'delete-yes') {
      void this.host.attempt(async () => {
        this.host.say('Deleting your account…');
        try { await this.deleteAccount?.(); } finally { this.deleting = false; }
        this.redeemed = undefined;
        this.host.say('Your account is deleted. This browser plays as a new guest now.');
      });
      return true;
    }
    return act === 'name' || act === 'redeem';
  }

  private submit(form: HTMLFormElement) {
    const field = form.querySelector<HTMLInputElement>('input'), value = field?.value.trim() ?? '';
    if (form.dataset.form === 'name') {
      const problem = nameProblem(value);
      if (problem) { this.host.say(problem); field?.focus(); return; }
      void this.host.attempt(async () => {
        await this.client.claimName(value);
        this.emptied.add('acct-name');
        this.host.say(`Your username is ${this.client.account?.name ?? value}.`);
      });
    } else if (form.dataset.form === 'code') {
      if (!value) { this.host.say('Type a code first.'); field?.focus(); return; }
      void this.host.attempt(async () => {
        this.host.say('Checking the code…');
        let got: Redeemed;
        try { got = await this.client.redeem(value); }
        catch (error) {
          if (!(error instanceof Refused) || error.need !== 'identity') throw error;
          this.host.say('Confirming your sign-in with Privy…');
          const identity = await this.identity?.();
          if (!identity) throw new Refused('Privy did not confirm your email to the game, so this code cannot check it. (Privy\'s app needs identity tokens switched on.)');
          got = await this.client.redeem(value, identity);
        }
        this.redeemed = got;
        this.emptied.add('acct-code');
        this.host.say(unlockedLine(got));
      });
    }
  }
}
