import './shop.css';
import type { FighterId } from '../../game/types';
import { CURRENCY, EARNED_LINE, money } from '../../game/economy/currency';
import { EMOTE_SLOTS, ITEM, ITEMS, KINDS, released, type Item, type ItemKind } from '../../game/economy/catalog';
import { EFFECT_KINDS, featured, turnover } from '../../game/economy/front';
import { RARITY } from '../../game/economy/rarity';
import { FEATS } from '../../game/economy/feats';
import { ALL_DAILY_BONUS, dailyMissions, weeklyMissions, type Mission } from '../../game/economy/missions';
import { PAY, levelOf } from '../../game/economy/earn';
import { cannotBuy, owns, type Account } from '../../game/economy/account';
import { ROAD, roadLevel } from '../../game/economy/unlocks';
import { Refused, type AccountClient, type Wallet } from './account';
import { fighterPage, itemArt } from './art';
import { AccountPanel } from './accountPanel';
import { goalOf, roadNext, savingFor, setGoal } from './goal';

type Tab = 'shop' | 'rewards' | 'locker' | 'account';
const TABS: readonly [Tab, string][] = [['shop', 'UNLOCKS'], ['rewards', 'REWARDS'], ['locker', 'LOCKER']];
const clock = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
  return d ? `${d}D ${h}H` : h ? `${h}H ${String(m).padStart(2, '0')}M` : `${m}M ${String(s % 60).padStart(2, '0')}S`; };
const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const thousands = (n: number) => Math.floor(n).toLocaleString('en-US');
const COIN = `<b class="shop-coin" aria-hidden="true">${CURRENCY.mark}</b>`;
const num = (text: string) => `<b class="shop-n">${text}</b>`;
const plural = (n: number, one: string, many = `${one}s`) => `${thousands(n)} ${n === 1 ? one : many}`;
const kindName = (item: Item) => KINDS[item.kind].one.toUpperCase();

const SHELVES: readonly { id: string; name: string; blurb: string; kinds: readonly ItemKind[] }[] = [
  { id: 'fighters', name: 'FIGHTERS', blurb: 'Yours in every mode. Try any of them first in the Training Ground.', kinds: ['fighter'] },
  { id: 'outfits', name: 'OUTFITS', blurb: 'Forms and costumes, every move the same. Everyone in the match sees them.', kinds: ['outfit'] },
  { id: 'effects', name: 'EFFECTS', blurb: 'What burns round your fighter, and how they are drawn. More are free on the road.', kinds: EFFECT_KINDS },
];
const LOCKER_SHELVES: readonly { id: string; name: string; kinds: readonly ItemKind[] }[] = [
  { id: 'fighters', name: 'FIGHTERS', kinds: ['fighter'] },
  { id: 'outfits', name: 'OUTFITS', kinds: ['outfit'] },
  { id: 'effects', name: 'EFFECTS', kinds: ['aura', 'skin', 'trail', 'kill', 'banner', 'form'] },
  { id: 'extras', name: 'EMOTES AND EXTRAS', kinds: ['emote', 'title', 'entrance', 'stamp', 'ko'] },
];
const SLOTS = ['aura', 'skin', 'trail', 'kill', 'banner', 'form', 'title', 'entrance', 'stamp', 'ko'] as const;

export const wears = (account: Account | undefined, item: Item) => !!account && (item.kind === 'emote' ? (account.worn.emotes ?? []).includes(item.id)
  : item.kind === 'outfit' ? !!item.fighter && account.worn.outfits?.[item.fighter] === item.id : item.kind !== 'fighter' && account.worn[item.kind] === item.id);

const refundTotal = (account: Account | undefined) => Object.values((account as { refunded?: Record<string, number> } | undefined)?.refunded ?? {}).reduce((sum, n) => sum + n, 0);
const SEEN = 'jump-shop-refund-seen';

export interface ShopStage {
  show(host: HTMLElement, fighter: FighterId, item: Item | undefined, account: Account | undefined): void;
  hide(): void;
}

export class Shop {
  readonly root: HTMLElement;
  private tab: Tab = 'shop';
  private tick = 0;
  private picked: Partial<Record<Tab, string>> = {};
  private confirming?: string;
  private confirmTimer = 0;
  private busy = false;
  private wallet: Wallet;
  private padTimer = 0;
  private padHeld = false;
  private scrolled: Partial<Record<Tab, number>> = {};
  stage?: ShopStage;
  onOpen = () => {};
  onClose = () => {};
  onPlay?: (fighter: FighterId, training: boolean) => void;
  readonly accountTab: AccountPanel;

  constructor(private readonly host: HTMLElement, private readonly client: AccountClient) {
    this.wallet = client.wallet;
    this.accountTab = new AccountPanel(client, { attempt: work => this.attempt(work), say: text => this.say(text) });
    this.root = document.createElement('section');
    this.root.className = 'shop hidden'; this.root.id = 'shop'; this.root.setAttribute('aria-label', 'Account');
    this.root.innerHTML = `
      <header class="shop-head">
        <h2 class="shop-name"><span>ACCOUNT</span><b aria-hidden="true">帳</b></h2>
        <nav class="shop-tabs" role="tablist" aria-label="Account sections">${TABS.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="false">${label}</button>`).join('')}</nav>
        <div class="shop-wallet" id="shop-wallet"></div>
        <button type="button" class="shop-account-button" data-tab="account" aria-selected="false">PROFILE</button>
        <button type="button" class="shop-close" id="shop-close" aria-label="Close Account">BACK <span aria-hidden="true">↩</span></button>
      </header>
      <p class="shop-earned" id="shop-earned">${COIN}<span>${EARNED_LINE}</span></p>
      <div class="shop-body" id="shop-body"></div>
      <p class="shop-status" id="shop-status" role="status" aria-live="polite"></p>`;
    host.append(this.root);
    this.root.addEventListener('click', event => this.click(event.target as HTMLElement));
    this.root.addEventListener('focusin', event => { const card = (event.target as HTMLElement).closest<HTMLElement>('[data-item]'); if (card && !card.dataset.act) this.pick(card.dataset.item!); });
    window.addEventListener('keydown', event => { if (!this.open || event.code !== 'Escape') return; event.preventDefault(); event.stopPropagation(); this.hide(); }, true);
    client.on(wallet => { this.wallet = wallet; if (this.open) this.render(); });
  }

  get open() { return !this.root.classList.contains('hidden'); }
  private get account() { return this.wallet.account; }
  private get fighter(): FighterId { return (this.host.querySelector<HTMLElement>('.home-fighter[aria-pressed=true]')?.dataset.fighter ?? 'naruto') as FighterId; }

  show(tab: string = this.tab) {
    this.tab = tab === 'missions' ? 'rewards' : (['shop', 'rewards', 'locker', 'account'] as const).find(each => each === tab) ?? 'shop';
    this.host.classList.add('shop-open'); this.root.classList.remove('hidden');
    this.say(this.wallet.live ? '' : 'Opening your account…');
    this.render();
    this.client.open().then(() => this.say(''), () => this.say('Account cannot reach the server. What you have unlocked is shown as it was last seen.'));
    this.onOpen();
    window.clearInterval(this.padTimer);
    this.padTimer = window.setInterval(() => { const held = [...(navigator.getGamepads?.() ?? [])].some(pad => pad?.buttons[1]?.pressed); if (held && !this.padHeld) this.hide(); this.padHeld = held; }, 60);
    window.setTimeout(() => this.root.querySelector<HTMLElement>('#shop-body [data-item][aria-pressed=true], [data-tab][aria-selected=true]')?.focus({ preventScroll: true }), 30);
    window.clearInterval(this.tick);
    this.tick = window.setInterval(() => this.countdowns(), 1000);
  }
  showItem(id: string) {
    const item = ITEM.get(id);
    if (!item) { this.show('shop'); return; }
    const tab: Tab = item.stage === 'road' ? 'rewards' : owns(this.account, id) || item.stage === 'retired' ? 'locker' : 'shop';
    this.picked[tab] = id; this.confirming = undefined;
    this.show(tab);
    window.setTimeout(() => { const card = this.root.querySelector<HTMLElement>(`#shop-body [data-item="${id}"]:not(.shop-hero):not(.shop-tile)`); card?.scrollIntoView({ block: 'nearest', inline: 'center' }); card?.focus({ preventScroll: true }); }, 60);
  }
  private countdowns() {
    const left = turnover(Date.now());
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-until]')) {
      const ms = el.dataset.until === 'week' ? left.week : left.day;
      el.textContent = clock(ms);
      if (ms < 1000) window.setTimeout(() => this.render(), 1500);
    }
  }
  hide() {
    if (!this.open) return;
    window.clearInterval(this.padTimer); window.clearInterval(this.tick);
    this.stage?.hide();
    this.root.classList.add('hidden'); this.host.classList.remove('shop-open');
    this.onClose();
    this.host.querySelector<HTMLElement>('#home-shop')?.focus({ preventScroll: true });
  }
  private say(text: string) { this.root.querySelector('#shop-status')!.textContent = text; }

  private render() {
    for (const tab of this.root.querySelectorAll<HTMLElement>('[data-tab]')) if (tab.matches('[role=tab], .shop-account-button')) tab.setAttribute('aria-selected', String(tab.dataset.tab === this.tab));
    this.renderWallet();
    const body = this.root.querySelector<HTMLElement>('#shop-body')!;
    const was = body.querySelector<HTMLElement>('.shop-scroll'), track = body.querySelector<HTMLElement>('.shop-road-track');
    if (was && body.dataset.tab) this.scrolled[body.dataset.tab as Tab] = was.scrollTop;
    const trackAt = track && body.dataset.tab === this.tab ? track.scrollLeft : undefined;
    const focused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('#shop [data-item], #shop [data-act], #shop [data-tab]');
    const refocus = focused ? (focused.dataset.act ? `[data-act="${focused.dataset.act}"]` : focused.dataset.item ? `[data-item="${focused.dataset.item}"]` : `[data-tab="${focused.dataset.tab}"]`) : '';
    body.dataset.tab = this.tab;
    if (this.tab === 'account') { this.stage?.hide(); this.accountTab.render(body, this.wallet); }
    else {
      const page = this.tab === 'shop' ? this.shopPage() : this.tab === 'rewards' ? this.rewardsPage() : this.lockerPage();
      body.innerHTML = `<div class="shop-scroll" id="shop-scroll">${page.html}</div><aside class="shop-detail" id="shop-detail" aria-live="polite"></aside>`;
      if (!this.picked[this.tab] || !page.ids.includes(this.picked[this.tab]!)) this.picked[this.tab] = page.first;
      this.markPicked();
      body.querySelector<HTMLElement>('.shop-scroll')!.scrollTop = this.scrolled[this.tab] ?? 0;
      const road = body.querySelector<HTMLElement>('.shop-road-track');
      if (road) road.scrollLeft = trackAt ?? Math.max(0, (road.querySelector<HTMLElement>('.shop-step.is-next')?.offsetLeft ?? road.scrollWidth) - road.clientWidth * .3);
      this.renderDetail();
    }
    if (refocus) this.root.querySelector<HTMLElement>(refocus)?.focus({ preventScroll: true });
  }

  private renderWallet() {
    const account = this.account, level = levelOf(account?.xp ?? 0), next = roadNext(account);
    this.root.querySelector('#shop-wallet')!.innerHTML = `
      <button type="button" class="shop-level" data-tab="rewards" aria-label="Level ${level.level}${next ? `: ${escape(next.item.name)} at level ${next.level}` : ''}. Open the rewards.">
        <b>${level.level}</b>
        <span><small>LEVEL ${level.level}${next ? ` · NEXT AT ${next.level}` : ''}</small><i><u style="width:${level.max ? 100 : Math.round(level.into / level.span * 100)}%"></u></i>
        <small class="shop-level-next">${next ? escape(next.item.name.toUpperCase()) : 'THE ROAD IS YOURS'}</small></span>
      </button>
      <div class="shop-balance" title="${EARNED_LINE}">${COIN}<strong>${thousands(account?.balance ?? 0)}</strong><small>${CURRENCY.name.toUpperCase()}</small></div>`;
  }

  private how(item: Item): { html: string; state: 'worn' | 'owned' | 'free' | 'price' | 'road' | 'retired' } {
    const account = this.account;
    if (wears(account, item)) return { html: 'WORN', state: 'worn' };
    if (owns(account, item.id)) return { html: item.kind === 'fighter' ? 'YOURS · PLAY' : 'UNLOCKED', state: 'owned' };
    if (item.stage === 'retired') return { html: 'RETIRED', state: 'retired' };
    const level = roadLevel(item.id);
    if (item.stage === 'road') return { html: `FREE · LV ${level}`, state: 'road' };
    if (level !== undefined) return { html: `<em>FREE · LV ${level}</em><span>or ${COIN}${thousands(item.price ?? 0)}</span>`, state: 'free' };
    return { html: `${COIN}${thousands(item.price ?? 0)}`, state: 'price' };
  }
  private card(item: Item, tag = false): string {
    const how = this.how(item), afford = (how.state === 'price' || how.state === 'free') && (this.account?.balance ?? 0) >= (item.price ?? Infinity);
    return `<button type="button" class="shop-card kind-${item.kind} r-${item.rarity} is-${how.state}${afford ? ' can-buy' : ''}" data-item="${item.id}" aria-pressed="false" aria-label="${escape(item.name)}, ${kindName(item).toLowerCase()}, ${escape(this.howWords(item))}">
      ${itemArt(item, this.fighter)}
      ${tag ? `<span class="shop-card-tag">${kindName(item)}</span>` : ''}
      ${how.state === 'owned' || how.state === 'worn' ? '<span class="shop-card-seal" aria-hidden="true">済</span>' : ''}
      <span class="shop-card-name">${escape(item.name)}</span>
      <span class="shop-card-how">${how.html}</span>
    </button>`;
  }
  private howWords(item: Item): string {
    const account = this.account, level = roadLevel(item.id);
    if (owns(account, item.id)) return account?.items[item.id] ? 'yours' : level !== undefined && levelOf(account?.xp ?? 0).level >= level ? `yours: free on the road at level ${level}` : 'yours: all access';
    if (item.stage === 'retired') return 'retired';
    if (item.stage === 'road') return `free on the road at level ${level}`;
    return `${level !== undefined ? `free on the road at level ${level}, or ` : ''}${thousands(item.price ?? 0)} ${CURRENCY.name}`;
  }

  private shopPage(): { html: string; ids: string[]; first?: string } {
    const now = Date.now(), week = featured(now), ids: string[] = [];
    const hero = week.fighter, side = [week.outfit, week.effect].filter((each): each is Item => !!each);
    const shelves = SHELVES.map(shelf => {
      const items = ITEMS.filter(item => item.stage === 'live' && shelf.kinds.includes(item.kind));
      ids.push(...items.map(item => item.id));
      const more = shelf.id === 'effects' ? ROAD.filter(step => ITEM.get(step.id)?.stage === 'road').length : 0;
      return `<section class="shop-shelf" data-shelf="${shelf.id}"><h3><span>${shelf.name}</span><small>${escape(shelf.blurb)}</small></h3>
        <div class="shop-cards shop-cards-${shelf.id}">${items.map(item => this.card(item, shelf.id === 'effects')).join('')}${more ? `<button type="button" class="shop-card shop-card-more" data-tab="rewards" aria-label="${more} more free on the road: open the rewards"><span class="shop-card-more-n">+${more}</span><span class="shop-card-name">FREE ON THE ROAD</span><span class="shop-card-how">REWARDS →</span></button>` : ''}</div></section>`;
    }).join('');
    return { ids, first: hero?.id ?? ids[0], html: `${this.refundNotice()}
      ${hero ? `<section class="shop-feature" aria-label="This week">
        <button type="button" class="shop-hero r-${hero.rarity}" data-item="${hero.id}" aria-pressed="false" aria-label="This week: ${escape(hero.name)}, ${escape(this.howWords(hero))}">
          <span class="shop-hero-lines" aria-hidden="true"></span>
          <b class="shop-hero-kanji" aria-hidden="true">${escape(hero.glyph ?? '')}</b>
          ${hero.fighter ? `<span class="shop-hero-art">${fighterPage(hero.fighter)}</span>` : ''}
          <span class="shop-hero-copy">
            <small>THIS WEEK · NEW IN <b data-until="week">${clock(turnover(now).week)}</b></small>
            <strong style="--chars:${Math.max(6, ...hero.name.split(' ').map(word => word.length))}">${escape(hero.name.toUpperCase())}</strong>
            <em>${escape(hero.blurb)}</em>
            <span class="shop-hero-how">${this.how(hero).html}</span>
          </span>
        </button>
        <div class="shop-feature-side">${side.map(item => `<button type="button" class="shop-tile kind-${item.kind} r-${item.rarity}" data-item="${item.id}" aria-pressed="false" aria-label="This week: ${escape(item.name)}, ${escape(this.howWords(item))}">
          ${itemArt(item, this.fighter)}<span class="shop-tile-copy"><small>THIS WEEK · ${kindName(item)}</small><strong>${escape(item.name)}</strong><span class="shop-tile-how">${this.how(item).html}</span></span></button>`).join('')}</div>
      </section>` : ''}
      ${shelves}` };
  }
  private refundNotice(): string {
    const account = this.account, total = refundTotal(account);
    if (!account || !total) return '';
    let seen = 0;
    try { seen = Number(localStorage.getItem(`${SEEN}:${account.pk}`)) || 0; } catch { }
    if (seen >= total) return '';
    return `<section class="shop-notice" role="note"><b class="shop-notice-mark" aria-hidden="true">${CURRENCY.mark}</b>
      <span><strong>COSTS DROPPED · ${COIN}${thousands(total - seen)} RETURNED</strong><small>Fighters now cost days of play, not weeks. The ${CURRENCY.name} you spent above today's cost is yours again.</small></span>
      <button type="button" class="shop-act off" data-act="notice">GOT IT</button></section>`;
  }

  private rewardsPage(): { html: string; ids: string[]; first?: string } {
    const account = this.account, xp = account?.xp ?? 0, level = levelOf(xp), next = roadNext(account), now = Date.now();
    const steps = ROAD.map(step => ({ ...step, item: ITEM.get(step.id)! })).filter(step => step.item);
    let marked = false;
    const track = steps.map(step => {
      const got = level.level >= step.level || owns(account, step.id), isNext = !got && !marked;
      if (isNext) marked = true;
      const state = got ? 'got' : isNext ? 'next' : 'ahead';
      const you = isNext ? `<span class="shop-road-you" aria-hidden="true"><b>YOU</b><small>LV ${level.level}</small></span>` : '';
      return `${you}<button type="button" class="shop-step is-${state} kind-${step.item.kind} r-${step.item.rarity}" data-item="${step.id}" role="listitem" aria-pressed="false" aria-label="Level ${step.level}: ${escape(step.item.name)}, ${kindName(step.item).toLowerCase()}, ${got ? 'yours' : isNext ? 'next' : `${step.level - level.level} levels away`}">
        <span class="shop-step-level"><small>LV</small>${step.level}</span>
        <span class="shop-step-art">${itemArt(step.item, this.fighter)}</span>
        <span class="shop-step-kind">${kindName(step.item)}</span>
        <span class="shop-step-name">${escape(step.item.name)}</span>
        <span class="shop-step-state">${got ? '✓ YOURS' : isNext ? '★ NEXT' : `IN ${plural(step.level - level.level, 'LEVEL')}`}</span>
      </button>`;
    }).join('');
    const ids = [...steps.map(step => step.id), ...(next ? [next.item.id] : [])], first = next?.item.id ?? steps[steps.length - 1]?.id;
    const feats = [...FEATS].sort((a, b) => Number(account?.feats.includes(a.id) ?? false) - Number(account?.feats.includes(b.id) ?? false));
    return { ids, first, html: `
      <section class="shop-climb" aria-label="Your level">
        <b class="shop-climb-level"><small>LEVEL</small>${level.level}</b>
        <div class="shop-climb-bar"><span><b>${level.max ? 'MAX' : `${thousands(level.into)} / ${thousands(level.span)} XP`}</b><small>Every match and run gives experience, online or on this device. Each level gives ${COIN}${PAY.level(Math.min(60, level.level + 1))} or more; the road's levels give more still.</small></span><i><u style="width:${level.max ? 100 : Math.round(level.into / level.span * 100)}%"></u></i></div>
        ${next ? `<button type="button" class="shop-climb-next kind-${next.item.kind}" data-item="${next.item.id}" aria-pressed="false"><span class="shop-climb-art">${itemArt(next.item, this.fighter)}</span><span class="shop-climb-copy"><small>NEXT · LEVEL ${next.level}</small><strong>${escape(next.item.name)}</strong><em>about ${plural(next.matches, 'match', 'matches')} away</em></span></button>`
          : '<p class="shop-climb-done">The whole road is yours.</p>'}
      </section>
      <section class="shop-road"><h3><span>THE ROAD</span><small>Free, for playing. Its fighters and outfits are under UNLOCKS too, for ${CURRENCY.name}, for whoever would rather not wait.</small></h3>
        <div class="shop-road-track" role="list">${track}</div></section>
      ${this.missions(now)}
      <section class="shop-feats"><h3><span>FEATS</span><small>${account?.feats.length ?? 0} OF ${FEATS.length} · each earns once</small></h3><ul>${feats.map(feat => `<li class="${account?.feats.includes(feat.id) ? 'done' : ''}"><b>${escape(feat.name)}</b><span>${escape(feat.text)}</span><em>${account?.feats.includes(feat.id) ? 'DONE' : `${COIN}${feat.pay}`}</em></li>`).join('')}</ul></section>` };
  }
  private missions(now: number): string {
    const account = this.account;
    if (!account) return `<section class="shop-missions"><p class="shop-empty">Finish a match and your missions start.</p></section>`;
    const row = (mission: Mission, book: { progress: Record<string, number>; done: string[] }) => {
      const done = book.done.includes(mission.id), at = done ? mission.goal : Math.min(mission.goal, Math.floor(book.progress[mission.id] ?? 0));
      return `<li class="${done ? 'done' : ''}"><span>${escape(mission.text)}</span><i><u style="width:${Math.round(at / mission.goal * 100)}%"></u></i><em>${done ? 'DONE' : `${thousands(at)} / ${thousands(mission.goal)}`}</em><b>${COIN}${mission.pay}</b></li>`;
    };
    const left = turnover(now), streak = account.streak.days, next = PAY.streak[streak % PAY.streak.length];
    return `<section class="shop-missions">
      <div><h3><span>TODAY</span><small>NEW IN <b data-until="day">${clock(left.day)}</b></small></h3><ul class="shop-mission-list">${dailyMissions(account.day.date).map(mission => row(mission, account.day)).join('')}</ul>
        <p class="shop-note${account.day.all ? ' done' : ''}">All three: +${COIN}${ALL_DAILY_BONUS}${account.day.all ? ' · DONE' : ''}. Every mode that earns ${CURRENCY.name} counts.</p></div>
      <div><h3><span>THIS WEEK</span><small>NEW IN <b data-until="week">${clock(left.week)}</b></small></h3><ul class="shop-mission-list">${weeklyMissions(account.week.id).map(mission => row(mission, account.week)).join('')}</ul></div>
      <div class="shop-day"><h3><span>EVERY DAY</span><small>${streak ? `DAY ${streak} RUNNING` : 'A DAY AT A TIME'}</small></h3>
        <div class="shop-streak" aria-label="Days in a row">${PAY.streak.map((pay, i) => `<span class="${streak && i < ((streak - 1) % PAY.streak.length) + 1 ? 'had' : ''}"><small>DAY ${i + 1}</small>${COIN}${pay}</span>`).join('')}</div>
        <p class="shop-note">The first match of a day earns ${COIN}${PAY.firstOfDay}${streak ? `, and tomorrow's ${COIN}${next} more` : ', and more each day in a row'}. Matches earn in full up to ${PAY.dailyCap} a day; past it, online matches earn a fifth and matches on this device nothing more. Missions and feats always earn. Matches with bots on this device earn half, solo runs in full; Training earns nothing.</p></div>
    </section>`;
  }

  private lockerPage(): { html: string; ids: string[]; first?: string } {
    const account = this.account, ids: string[] = [];
    const mine = ITEMS.filter(item => released(item) && owns(account, item.id));
    const shelves = LOCKER_SHELVES.map(shelf => {
      const items = mine.filter(item => shelf.kinds.includes(item.kind));
      ids.push(...items.map(item => item.id));
      return items.length ? `<section class="shop-shelf"><h3><span>${shelf.name}</span><small>${items.length}</small></h3><div class="shop-cards shop-cards-${shelf.id}">${items.map(item => this.card(item, shelf.id !== 'fighters' && shelf.id !== 'outfits')).join('')}</div></section>` : '';
    }).join('');
    const worn = account ? SLOTS.map(kind => ({ kind, item: ITEM.get(account.worn[kind] ?? '') })).filter((slot): slot is { kind: typeof SLOTS[number]; item: Item } => !!slot.item) : [];
    const outfits = account ? Object.values(account.worn.outfits ?? {}).map(id => ITEM.get(id ?? '')).filter((item): item is Item => !!item) : [];
    const emotes = (account?.worn.emotes ?? []).map(id => ITEM.get(id)).filter((item): item is Item => !!item);
    const chips: [string, Item][] = [...outfits.map(item => ['OUTFIT', item] as [string, Item]), ...worn.map(slot => [KINDS[slot.kind].one.toUpperCase(), slot.item] as [string, Item]), ...emotes.map((item, i) => [`EMOTE ${i + 1}`, item] as [string, Item])];
    return { ids, first: chips[0]?.[1].id ?? ids[0], html: `
      <section class="shop-wearing"><h3><span>WEARING</span><small>${emotes.length} of ${EMOTE_SLOTS} emotes on the wheel: keys 1-4 or the D-pad in a fight</small></h3>
        <div class="shop-chips">${chips.length ? chips.map(([slot, item]) => `<button type="button" class="shop-chip-worn" data-item="${item.id}" aria-pressed="false"><small>${slot}</small>${escape(item.name)}</button>`).join('') : '<p class="shop-empty">Nothing worn yet. Pick something you have unlocked and press WEAR.</p>'}</div></section>
      ${shelves || '<p class="shop-empty">Nothing here yet. The road gives the first things in your first matches.</p>'}` };
  }

  private markPicked() {
    const id = this.picked[this.tab];
    for (const card of this.root.querySelectorAll<HTMLElement>('#shop-body [data-item]')) card.setAttribute('aria-pressed', String(card.dataset.item === id));
  }
  private pick(id: string) {
    if (this.picked[this.tab] === id) return;
    this.picked[this.tab] = id; this.confirming = undefined;
    this.markPicked();
    this.renderDetail();
  }

  private renderDetail() {
    const detail = this.root.querySelector<HTMLElement>('#shop-detail');
    if (!detail) return;
    const item = ITEM.get(this.picked[this.tab] ?? ''), account = this.account;
    if (!item) { detail.innerHTML = ''; this.stage?.hide(); return; }
    const mine = owns(account, item.id), worn = wears(account, item), level = roadLevel(item.id), at = levelOf(account?.xp ?? 0).level, goal = goalOf(account)?.id === item.id;
    let how = '';
    if (mine) how = `<div class="shop-how is-mine"><b>YOURS</b><span>${escape(this.howWords(item).replace(/^yours:?\s*/, '') || 'In your locker.')}</span></div>`;
    else if (item.stage === 'retired') how = `<div class="shop-how"><b>RETIRED</b><span>Whoever unlocked it keeps it.</span></div>`;
    else {
      if (level !== undefined) { const left = Math.max(0, level - at);
        how += `<div class="shop-how is-road"><b>FREE AT LEVEL ${level}</b><span>${left ? `You are level ${at}: ${plural(left, 'level')} to go.` : 'Yours at your next match.'}</span><i><u style="width:${Math.round(Math.min(1, at / level) * 100)}%"></u></i></div>`; }
      if (item.price !== undefined) { const save = savingFor(account, item);
        how += `<div class="shop-how is-price"><b>${level !== undefined ? 'OR UNLOCK NOW · ' : 'COSTS '}${COIN}${thousands(save.price)}</b><span>${save.left ? `You have ${thousands(save.have)}: about ${plural(save.matches, 'match', 'matches')} to go.` : `You have ${thousands(save.have)}.`}</span><i><u style="width:${Math.round(save.share * 100)}%"></u></i><small class="shop-how-earned">${EARNED_LINE}</small></div>`; }
    }
    const acts: string[] = [];
    if (item.kind === 'fighter' && mine) acts.push(`<button type="button" class="shop-act" data-act="play">PLAY AS ${escape(item.name.toUpperCase())}</button>`);
    else if (mine) acts.push(`<button type="button" class="shop-act${worn ? ' off' : ''}" data-act="wear">${item.kind === 'emote' ? (worn ? 'TAKE OFF THE WHEEL' : 'PUT ON THE WHEEL') : worn ? 'TAKE OFF' : 'WEAR'}</button>`);
    else if (item.stage === 'live' && item.price !== undefined) {
      const no = cannotBuy(account ?? ({ items: {}, feats: [], xp: 0, balance: 0, worn: {} } as unknown as Account), item.id, this.wallet.sold[item.id] ?? 0);
      acts.push(no ? `<button type="button" class="shop-act" disabled>${COIN}${num(thousands(item.price))}</button>`
        : `<button type="button" class="shop-act${this.confirming === item.id ? ' sure' : ''}" data-act="buy">${this.confirming === item.id ? `PRESS AGAIN TO UNLOCK · ${COIN}${num(thousands(item.price))}` : `UNLOCK · ${COIN}${num(thousands(item.price))}`}</button>`);
      if (no && !/costs/.test(no)) acts.push(`<p class="shop-why">${escape(no)}</p>`);
    }
    if (item.kind === 'fighter') acts.push(`<button type="button" class="shop-act off" data-act="try">${mine ? 'THE TRAINING GROUND' : 'TRY IN THE TRAINING GROUND'}</button>`);
    if (!mine && item.stage === 'live' && item.price !== undefined) acts.push(`<button type="button" class="shop-act off shop-goal${goal ? ' is-goal' : ''}" data-act="goal" aria-pressed="${goal}">${goal ? '★ YOUR GOAL' : '☆ SET AS YOUR GOAL'}</button>`);
    const forWho = item.kind === 'outfit' && item.fighter ? ` · FOR ${escape((ITEM.get(`fighter-${item.fighter}`)?.name ?? item.fighter).toUpperCase())}` : '';
    detail.className = `shop-detail r-${item.rarity} kind-${item.kind}`;
    detail.innerHTML = `
      <div class="shop-stage" id="shop-stage">${itemArt(item, this.fighter)}</div>
      <div class="shop-detail-text">
        <span class="shop-detail-kind"><b>${kindName(item)}</b>${RARITY[item.rarity].name.toUpperCase()}${forWho}</span>
        <h3>${escape(item.name)}</h3>
        <p>${escape(item.blurb)}</p>
        ${how}
        <div class="shop-acts">${acts.join('')}</div>
      </div>`;
    this.stage?.show(detail.querySelector<HTMLElement>('#shop-stage')!, this.fighter, item, account);
  }

  private click(target: HTMLElement) {
    const button = target.closest<HTMLElement>('button');
    if (!button || (button as HTMLButtonElement).disabled) return;
    if (button.id === 'shop-close') { this.hide(); return; }
    if (button.dataset.tab) { this.tab = button.dataset.tab as Tab; this.confirming = undefined; this.render(); return; }
    if (this.tab === 'account' && this.accountTab.click(button)) return;
    if (button.dataset.item && !button.dataset.act) { this.pick(button.dataset.item); return; }
    const act = button.dataset.act, item = ITEM.get(this.picked[this.tab] ?? '');
    if (act === 'notice') { try { localStorage.setItem(`${SEEN}:${this.account?.pk}`, String(refundTotal(this.account))); } catch { } this.render(); return; }
    if (!item || this.busy) return;
    if (act === 'goal') {
      const was = goalOf(this.account)?.id === item.id;
      setGoal(was ? undefined : item.id);
      this.say(was ? '' : `${item.name} is your goal: the home screen and what each match earns count you towards it.`);
      this.renderDetail(); return;
    }
    if ((act === 'play' || act === 'try') && item.fighter) { this.hide(); this.onPlay?.(item.fighter, act === 'try'); return; }
    if (act === 'buy') {
      if (this.confirming !== item.id) { this.confirming = item.id; window.clearTimeout(this.confirmTimer); this.confirmTimer = window.setTimeout(() => { this.confirming = undefined; this.renderDetail(); }, 5000); this.renderDetail(); this.root.querySelector<HTMLElement>('[data-act=buy]')?.focus(); return; }
      this.confirming = undefined; window.clearTimeout(this.confirmTimer);
      void this.attempt(async () => { await this.client.buy(item.id); this.say(`${item.name} is yours.`); this.stamp(item.id); });
    } else if (act === 'wear') {
      const off = wears(this.account, item);
      void this.attempt(async () => { await this.client.wear(item.kind, off && item.kind !== 'emote' && item.kind !== 'outfit' ? undefined : item.id); this.say(off ? `${item.name} taken off.` : `${item.name} is on.`); });
    }
  }
  private async attempt(work: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true; this.root.classList.add('busy');
    try { await work(); }
    catch (error) {
      const message = (error as Error)?.message ?? '';
      if (message === 'cancelled' || (error as { cancelled?: boolean })?.cancelled) this.say('');
      else this.say(error instanceof Refused ? message : /sign-in|privy/i.test(message) ? message : 'The server could not be reached. Try again in a moment.');
    }
    finally { this.busy = false; this.root.classList.remove('busy'); this.render(); }
  }

  private stamp(id: string) { window.setTimeout(() => { for (const seal of this.root.querySelectorAll(`.shop-card[data-item="${id}"] .shop-card-seal`)) seal.classList.add('fresh'); }, 0); }
}

export function homeChip(account: Account | undefined): string {
  const level = levelOf(account?.xp ?? 0), next = roadNext(account), goal = goalOf(account);
  return `<b class="shop-chip-level">LV ${level.level}</b>${next ? `<em class="shop-chip-next"><i><u style="width:${Math.round(next.share * 100)}%"></u></i>NEXT · ${escape(next.item.name.toUpperCase())} AT ${next.level}</em>` : ''}${goal ? `<em class="shop-chip-goal">★ ${escape(goal.name.toUpperCase())} ${thousands(Math.min(account?.balance ?? 0, goal.price ?? 0))}/${thousands(goal.price ?? 0)}</em>` : ''}<strong class="shop-chip-money">${COIN}${thousands(account?.balance ?? 0)}</strong>`;
}
export { money };
