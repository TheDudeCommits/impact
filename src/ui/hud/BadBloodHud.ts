import type { FighterId, GameSnapshot, PlayerState } from '../../game/types';
import type { ObjectiveSeat, ObjectiveView } from '../../game/objectives/model';
import { FIGHTERS } from '../../config';
import type { ModeHud, ModeHudFrame, ModeHudMount } from './modeHud';
import { el, Text, Fill, Flag, Face, Data, PromptLane } from './kit';
import { EdgeMarkers, type EdgeSubject } from './EdgeMarkers';
import { hudView } from './hudView';
import { castThreat, THREAT_HEX } from '../../render/ThreatOutline';
import { POWER, badgeCopy, badgeKind, faceMark, faceState, returnAsk, targetTag } from './modeCopy';
import './badBloodHud.css';

const BANNER_MS = 2600, EDGE_RANGE = 34, EDGE_COUNT = 2;

const nameOf = (seat: ObjectiveSeat) => (seat.name === 'Fighter' ? FIGHTERS[seat.fighter].name : seat.name).toUpperCase();
function playerOf(snapshot: GameSnapshot, id: string): PlayerState | undefined { for (const p of snapshot.players) if (p.id === id) return p; return undefined; }
function seatOf(v: ObjectiveView, id: string | undefined): ObjectiveSeat | undefined { if (!id) return undefined; for (const s of v.seats) if (s.id === id) return s; return undefined; }

interface Slot { seat: string; root: HTMLElement; face: Face; hp: Fill; mark: Text; state: Data; shown: string }

export function createBadBloodHud(): ModeHud { return new BadBloodHud(); }

class BadBloodHud implements ModeHud {
  private bar!: HTMLElement; private side!: Data;
  private heroes!: HTMLElement; private villains!: HTMLElement; private heroLabel!: Text; private villainLabel!: Text;
  private heroCount!: Text; private villainCount!: Text;
  private slots: Slot[] = []; private rosterKey = '';
  private badge!: HTMLElement; private badgeText!: Text; private badgeKind!: Data; private badgeShown!: Flag;
  private tag!: HTMLElement; private tagText!: Text; private tagKind!: Data; private tagShown!: Flag;
  private notice!: HTMLElement; private noticeTitle!: Text; private noticeDetail!: Text; private noticeShown!: Flag;
  private banner!: HTMLElement; private bannerOn!: Flag; private bannerTitle!: Text; private bannerLine!: Text;
  private markers?: EdgeMarkers; private pool: (EdgeSubject & { d: number })[] = []; private lane?: PromptLane;
  private lastHeroes = -1; private bannerUntil = 0;
  private shownHeroes = -1; private shownVillains = -1;

  mount(m: ModeHudMount) {
    this.bar = el('div', 'bb-bar', m.zone('2')); this.side = new Data(this.bar, 'side');
    const heroes = el('div', 'bb-team heroes', this.bar);
    this.heroLabel = new Text(el('small', '', heroes)); this.heroes = el('div', 'bb-faces', heroes);
    const count = el('div', 'bb-count', this.bar);
    this.heroCount = new Text(el('b', 'heroes', count)); el('span', '', count, 'VS'); this.villainCount = new Text(el('b', 'villains', count));
    const villains = el('div', 'bb-team villains', this.bar);
    this.villainLabel = new Text(el('small', '', villains)); this.villains = el('div', 'bb-faces', villains);

    this.badge = el('div', 'bb-badge hidden', m.zone('1b')); this.badgeText = new Text(this.badge); this.badgeKind = new Data(this.badge, 'kind');
    this.badgeShown = new Flag(this.badge); this.badgeShown.set(true);
    this.tag = el('div', 'bb-tag hidden', m.zone('3b')); this.tagText = new Text(this.tag); this.tagKind = new Data(this.tag, 'kind');
    this.tagShown = new Flag(this.tag); this.tagShown.set(true);

    this.lane = new PromptLane(m.zone('6'));
    this.notice = el('div', 'hk-slip bb-notice hidden', m.zone('6'));
    this.noticeTitle = new Text(el('span', '', this.notice)); this.noticeDetail = new Text(el('small', '', this.notice));
    this.noticeShown = new Flag(this.notice); this.noticeShown.set(true);

    this.banner = el('div', 'hk-banner bb-banner', m.zone('7'));
    el('small', '', this.banner, 'BAD BLOOD');
    this.bannerTitle = new Text(el('strong', '', this.banner)); this.bannerLine = new Text(el('span', '', this.banner));
    this.bannerOn = new Flag(this.banner, 'on');

    this.markers = new EdgeMarkers(m.zone('8'), EDGE_COUNT, EDGE_RANGE);
  }

  update(f: ModeHudFrame) {
    const v = f.objective;
    if (!v || v.kind !== 'bad-blood') return;
    const snapshot = f.snapshot, now = snapshot.serverTime, active = f.phase === 'active';
    const own = seatOf(v, f.self.id), team = own?.team === 'villains' ? 'villains' : 'heroes';

    this.roster(v, team, f.self.id);
    let heroes = 0, villains = 0;
    for (const p of snapshot.players) if (p.alive && !p.enemy) { if (p.team === 'heroes') heroes++; else if (p.team === 'villains') villains++; }
    if (heroes !== this.shownHeroes) { this.shownHeroes = heroes; this.heroCount.set(String(heroes)); }
    if (villains !== this.shownVillains) { this.shownVillains = villains; this.villainCount.set(String(villains)); }
    for (const slot of this.slots) {
      const seat = seatOf(v, slot.seat); if (!seat) continue;
      const p = playerOf(snapshot, seat.id), alive = !!p?.alive, state = faceState(seat, alive);
      slot.state.set(state);
      const mark = faceMark(state, seat, now);
      if (mark !== slot.shown) { slot.shown = mark; slot.mark.set(mark); }
      slot.hp.set(alive ? (p!.hp / Math.max(1, p!.maxHp)) : 0);
    }

    this.badgeShown.set(!own || !active);
    if (own) {
      const kind = badgeKind(own, f.self.alive);
      this.badgeKind.set(kind); this.badgeText.set(badgeCopy(kind, own, now));
    }

    const target = f.target && f.target.alive ? seatOf(v, f.target.id) : undefined;
    this.tagShown.set(!active || !target);
    if (target) {
      this.tagKind.set(target.team);
      this.tagText.set(targetTag(target));
    }

    let next: ObjectiveSeat | undefined;
    for (const seat of v.seats) if (seat.reviveAt !== undefined && seat.id !== f.self.id && (!next || seat.reviveAt < next.reviveAt!)) next = seat;
    const nextP = next ? playerOf(snapshot, next.id) : undefined;
    this.lane?.setCritical(active && !f.self.alive);
    const wanted = active && !!next && !nextP?.alive, showNotice = wanted && !this.lane?.coachShowing();
    this.noticeShown.set(!showNotice);
    if (showNotice && next) {
      this.noticeTitle.set(`${nameOf(next)} RETURNS IN ${Math.max(1, Math.ceil(next.reviveAt! - now))}s`);
      this.noticeDetail.set(returnAsk(team, heroes));
    }

    if (active && heroes === 1 && this.lastHeroes > 1) {
      this.bannerUntil = f.now + BANNER_MS;
      this.bannerTitle.set('LAST HERO STANDING');
      let pending = false; for (const seat of v.seats) if (seat.team === 'heroes' && seat.reviveAt !== undefined) pending = true;
      this.bannerLine.set(team === 'heroes' ? (pending ? 'HOLD ON · THEY RETURN' : 'NO RETURNS LEFT') : 'FINISH IT');
    }
    if (active) this.lastHeroes = heroes;
    this.bannerOn.set(f.now < this.bannerUntil);

    this.edgeMarkers(snapshot, f.self, f.target?.id, team, active);
  }

  unmount() { this.lane?.clear(); this.markers?.destroy(); this.markers = undefined; this.slots = []; this.rosterKey = ''; this.lastHeroes = -1; }

  private roster(v: ObjectiveView, team: 'heroes' | 'villains', ownId: string) {
    let key = `${team}:${ownId}`;
    for (const seat of v.seats) key += `|${seat.id}:${seat.fighter}:${seat.team}`;
    if (key === this.rosterKey) return;
    this.rosterKey = key; this.slots = [];
    this.heroes.replaceChildren(); this.villains.replaceChildren();
    for (const seat of v.seats) {
      if (seat.team !== 'heroes' && seat.team !== 'villains') continue;
      const root = el('span', `bb-face${seat.id === ownId ? ' is-you' : ''}`, seat.team === 'heroes' ? this.heroes : this.villains);
      root.title = nameOf(seat);
      const face = new Face(el('span', 'bb-portrait', root)); face.set(seat.fighter as FighterId);
      const hp = new Fill(el('i', '', el('i', 'bb-hp', root)));
      const mark = new Text(el('b', 'bb-mark', root));
      this.slots.push({ seat: seat.id, root, face, hp, mark, state: new Data(root, 'state'), shown: '' });
    }
    this.side.set(team);
    this.heroLabel.set(team === 'heroes' ? 'HEROES · YOU' : 'HEROES · ↻ RETURN');
    this.villainLabel.set(team === 'villains' ? `VILLAINS · ${POWER} · YOU` : `VILLAINS · ${POWER}`);
  }
  private edgeMarkers(snapshot: GameSnapshot, self: PlayerState, targetId: string | undefined, team: string, active: boolean) {
    if (!this.markers) return;
    if (!active || !self.alive || !hudView.camera) { this.markers.hide(); return; }
    let n = 0;
    for (const p of snapshot.players) {
      if (!p.alive || p.enemy || p.id === self.id || p.id === targetId || !p.team || p.team === team) continue;
      const c = this.pool[n] ??= { id: '', x: 0, y: 0, z: 0, fighter: p.fighter, name: '', colour: '', d: 0 };
      if (c.id !== p.id) { c.id = p.id; c.fighter = p.fighter; c.name = FIGHTERS[p.fighter].name.toUpperCase(); }
      c.x = p.x; c.y = p.y + 1.2; c.z = p.z; c.colour = THREAT_HEX[castThreat(p).level];
      c.d = Math.hypot(p.x - self.x, p.z - self.z); n++;
    }
    for (let i = 1; i < n; i++) { const c = this.pool[i]; let j = i - 1; while (j >= 0 && this.pool[j].d > c.d) { this.pool[j + 1] = this.pool[j]; j--; } this.pool[j + 1] = c; }
    this.markers.update(hudView.camera, self, this.pool, n, innerWidth, innerHeight);
  }
}
