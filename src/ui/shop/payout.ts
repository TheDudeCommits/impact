import { CURRENCY } from '../../game/economy/currency';
import { levelOf, payFor, plausible, type PayLine, type Report } from '../../game/economy/earn';
import { ITEM } from '../../game/economy/catalog';
import { reachedOnRoad } from '../../game/economy/unlocks';
import type { Account } from '../../game/economy/account';
import { isDeviceId } from '../../game/economy/device';
import { account, type AccountClient } from './account';
import { goalOf, roadNext, savingFor } from './goal';

const COIN = `<b class="shop-coin" aria-hidden="true">${CURRENCY.mark}</b>`;
const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const whole = (n: number) => Math.round(n).toLocaleString('en-US');

function nearer(level: { from: number; to: number }, who: Account | undefined): string {
  const got = reachedOnRoad(level.from, level.to).map(step => ITEM.get(step.id)).filter(item => !!item);
  const next = roadNext(who), goal = goalOf(who), save = goal ? savingFor(who, goal) : undefined;
  const parts = [
    ...got.map(item => `<strong>UNLOCKED · ${escape(item!.name.toUpperCase())}</strong>`),
    next ? `<span>NEXT · ${escape(next.item.name.toUpperCase())} AT LEVEL ${next.level}<i><u style="width:${Math.round(next.share * 100)}%"></u></i><small>${whole(next.xpLeft)} XP TO GO</small></span>` : '',
    goal && save ? `<span>GOAL · ${escape(goal.name.toUpperCase())}<i><u style="width:${Math.round(save.share * 100)}%"></u></i><small>${whole(save.have)} / ${whole(save.price)} ${CURRENCY.name.toUpperCase()}</small></span>` : '',
  ].filter(Boolean);
  return parts.length ? `<div class="pay-next">${parts.join('')}</div>` : '';
}

function draw(host: HTMLElement, what: { kicker: string; total: string; lines: (PayLine & { big?: boolean })[]; level?: { from: number; to: number; xp: number }; note?: string; waiting?: boolean; who?: Account }) {
  const level = what.level ? levelOf(what.level.xp) : undefined;
  host.classList.remove('hidden');
  host.innerHTML = `<div class="pay${what.waiting ? ' waiting' : ''}">
    <div class="pay-total"><small>${escape(what.kicker)}</small>${COIN}<strong>${escape(what.total)}</strong></div>
    <ul class="pay-lines">${what.lines.map((line, i) => `<li class="${line.big ? 'big' : ''}" style="animation-delay:${Math.min(1.2, i * .07).toFixed(2)}s"><span>${escape(line.label)}</span><b>+${whole(line.amount)}</b></li>`).join('')}</ul>
    ${level && what.level ? `<div class="pay-level"><span>${what.level.to > what.level.from ? `LEVEL ${what.level.from} → ${what.level.to}` : `LEVEL ${level.level}`}</span><i><u style="width:${level.max ? 100 : Math.round(level.into / level.span * 100)}%"></u></i><small>${level.max ? 'MAX' : `${whole(level.span - level.into)} XP TO LEVEL ${level.level + 1}`}</small></div>` : ''}
    ${what.level && what.who ? nearer(what.level, what.who) : ''}
    ${what.note ? `<p class="pay-note">${escape(what.note)}</p>` : ''}
  </div>`;
}

export async function showPay(host: HTMLElement, report: Report | undefined, kicker: string, client: AccountClient = account, verified = false): Promise<boolean> {
  if (!report) { host.classList.add('hidden'); host.replaceChildren(); return false; }
  const checked = plausible(report, verified);
  if ('refused' in checked) { draw(host, { kicker, total: '0', lines: [], note: checked.refused }); return false; }
  const base = payFor(checked.report), own = new Set(base.map(line => line.label));
  draw(host, { kicker, total: `+${whole(base.reduce((sum, line) => sum + line.amount, 0))}`, lines: base, waiting: true });
  const outcome = await client.report(report);
  if (outcome.settlement) {
    const s = outcome.settlement;
    draw(host, { kicker, total: `+${whole(s.total)}`, lines: s.lines.map(line => ({ ...line, big: !own.has(line.label) })), level: { ...s.level, xp: client.account?.xp ?? 0 }, who: client.account,
      note: !s.capped ? undefined : isDeviceId(report.id) ? "Matches have earned the day's cap: matches on this device earn nothing more until tomorrow. Missions and feats still earn."
        : "Matches have earned the day's cap: they earn a fifth from here until tomorrow. Missions, feats and levels still earn in full." });
    return true;
  }
  draw(host, { kicker, total: `+${whole(base.reduce((sum, line) => sum + line.amount, 0))}`, lines: base, waiting: true,
    note: outcome.later ? `${outcome.later} This result is kept, and sent again later.` : outcome.kept ? 'The server could not be reached. This result is kept, and is counted the next time it can.' : outcome.refused ?? 'This result earned nothing.' });
  return false;
}
