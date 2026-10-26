import type { GameSnapshot, PlayerState } from '../../game/types';
import type { ObjectiveSeat, ObjectiveView } from '../../game/objectives/model';
import { LANES, VILLAGE } from '../../game/objectives/lastStand';
import type { VillageStructure } from '../../game/objectives/villageStructures';
import { ENEMIES } from '../../survival/enemies';
import { FIGHTERS } from '../../config';
import { prompt } from '../prompts';
import type { ModeHud, ModeHudFrame, ModeHudMount } from './modeHud';
import { el, Text, Markup, Flag, Plaque, WideBar, PromptLane, grouped, clockOf } from './kit';
import { LANE_OF, levelNote, struckStructure, wavePlaque, waveLine } from './modeCopy';
import { ToriiGauge } from './lastStand/torii';
import { HexSquad, ROAD_KANJI } from './lastStand/hexSquad';
import { BrushQuest } from './lastStand/brushQuest';
import { LevelStar } from './lastStand/levelStar';
import { InkThreat, sideOf } from './lastStand/inkThreat';
import { CutIn } from './lastStand/cutIn';
import './lastStandHud.css';
import './lastStand/lastStandAnime.css';

const COUNTER: Record<string, string> = { captain: 'SHIELD CAPTAIN · STAGGER TO BREAK THE WARD', medic: 'FIELD MEDIC · INTERRUPT THE HEAL', sapper: 'DEMOLITION RAIDER · STOP THE BREACH' };
const PHASES = ['I', 'II', 'III'];
const BANNER_MS = 3200;
const SEAL: Record<string, string> = { leaders: '鎖', swift: '疾', bulwark: '盾', rescue: '救', supplies: '補' };

const nameOf = (seat: ObjectiveSeat) => (seat.name === 'Fighter' ? FIGHTERS[seat.fighter].name : seat.name).toUpperCase();
function playerOf(snapshot: GameSnapshot, id: string | undefined): PlayerState | undefined {
  if (!id) return undefined;
  for (const p of snapshot.players) if (p.id === id) return p;
  return undefined;
}

export function createLastStandHud(): ModeHud { return new LastStandHud(); }

interface Alert { lane: number; raiders: number; hot: boolean; rank: number; x: number; z: number }

class LastStandHud implements ModeHud {
  private plaque!: Plaque;
  private torii!: ToriiGauge; private squad!: HexSquad; private optional!: BrushQuest;
  private star!: LevelStar; private inks!: { left: InkThreat; right: InkThreat }; private cut!: CutIn;
  private boss!: WideBar; private bossShown!: Flag;
  private funds!: HTMLElement; private fundsText!: Text; private fundsShown!: Flag;
  private shop!: HTMLButtonElement; private shopKey = ''; private shopShown!: Flag; private shopMarkup!: Markup;
  private counter!: HTMLElement; private counterText!: Text; private counterShown!: Flag;
  private banner!: HTMLElement; private bannerOn!: Flag; private bannerKicker!: Text; private bannerTitle!: Text; private bannerLine!: Text;
  private lane?: PromptLane;
  private bannerChapter = 0; private bannerUntil = 0;
  private shownWave = -1; private shownLeft = -1; private shownPhase = ''; private shownSub = -1; private shownPoints = -1;
  private clearedAt = -1; private lastPhase = '';
  private bossKey = '';
  private allies: string[] = []; private rosterKey = '';
  private spans = new Map<string, number>();
  private cutBoss = ''; private cutQuest = ''; private cutOptional = -1;

  mount(m: ModeHudMount) {
    this.plaque = new Plaque(m.zone('2'), 'ls-plaque');
    const right = m.zone('3');
    this.torii = new ToriiGauge(right);
    this.squad = new HexSquad(right);
    this.optional = new BrushQuest(right, 'ls-optional'); this.optional.hide();
    this.boss = new WideBar(m.zone('9'), 'ls-boss hidden'); this.bossShown = new Flag(this.boss.root); this.bossShown.set(true);

    this.star = new LevelStar(m.combat, m.zone('1b'));
    this.funds = el('div', 'hk-slip ink ls-funds hidden', m.zone('1b')); this.fundsText = new Text(el('span', '', this.funds));
    el('small', '', this.funds, 'VISIT THE QUARTERMASTER');
    this.fundsShown = new Flag(this.funds); this.fundsShown.set(true);

    const lane = m.zone('6'); this.lane = new PromptLane(lane);
    this.shop = el('button', 'ls-shop hidden', lane); this.shop.type = 'button';
    this.shop.setAttribute('aria-label', 'Open the village quartermaster');
    this.shop.onclick = () => document.querySelector<HTMLButtonElement>('.objective-shop-prompt')?.click();
    this.shopMarkup = new Markup(this.shop); this.shopShown = new Flag(this.shop); this.shopShown.set(true);
    this.counter = el('div', 'hk-slip ink ls-counter hidden', lane); this.counterText = new Text(el('span', '', this.counter));
    this.counterShown = new Flag(this.counter); this.counterShown.set(true);

    this.banner = el('div', 'hk-banner ls-banner', m.zone('7'));
    this.bannerKicker = new Text(el('small', '', this.banner)); this.bannerTitle = new Text(el('strong', '', this.banner)); this.bannerLine = new Text(el('span', '', this.banner));
    this.bannerOn = new Flag(this.banner, 'on');

    const edges = m.zone('8');
    this.inks = { left: new InkThreat(edges, 'left'), right: new InkThreat(edges, 'right') };
    this.cut = new CutIn(edges);
  }

  update(f: ModeHudFrame) {
    const v = f.objective, city = v?.village;
    if (!v || !city || v.kind !== 'last-stand') return;
    const snapshot = f.snapshot, now = snapshot.serverTime, self = f.self, active = f.phase === 'active';
    const preparing = city.phase === 'preparation';
    const seat = this.seatOf(v, self.id);

    if (city.phase !== this.lastPhase) { if (preparing && city.wave > 0) this.clearedAt = now; this.lastPhase = city.phase; }
    const wave = preparing ? city.wave + 1 : city.wave;
    const left = preparing ? Math.max(0, Math.ceil(city.nextWaveAt - now)) : city.remaining;
    if (wave !== this.shownWave || left !== this.shownLeft || city.phase !== this.shownPhase) {
      this.shownWave = wave; this.shownLeft = left; this.shownPhase = city.phase;
      const plaque = wavePlaque(city, now); this.plaque.lead.set(plaque.lead); this.plaque.accent.set(plaque.accent);
    }
    const bossPlayer = city.bossActor ? playerOf(snapshot, city.bossActor) : undefined;
    const boss = bossPlayer?.alive ? bossPlayer : undefined;
    const lineKey = (city.wave * 8 + (city.bossPhase ?? 0)) * 8 + (boss ? 4 : 0) + (preparing ? 2 : 0) + (city.director?.state === 'rally' ? 1 : 0) + (preparing && now - this.clearedAt < 4 ? .5 : 0);
    if (lineKey !== this.shownSub) { this.shownSub = lineKey; this.plaque.sub.set(waveLine(city, now, this.clearedAt, !!boss)); }

    this.village(city);

    this.bossShown.set(!boss);
    if (boss) {
      const key = `${boss.id}:${city.bossPhase ?? 0}`;
      if (key !== this.bossKey) { this.bossKey = key; this.boss.label.set(`BOSS · ${boss.name.toUpperCase()}`); this.boss.tag.set(`PHASE ${PHASES[city.bossPhase ?? 0] ?? 'I'}`); }
      this.boss.value.set(`${grouped.format(Math.max(0, Math.ceil(boss.hp)))} HP`);
      this.boss.set(boss.hp / Math.max(1, boss.maxHp), f.now);
      if (active && boss.id !== this.cutBoss) {
        this.cutBoss = boss.id;
        const kind = boss.enemy ?? '', def = ENEMIES[kind];
        this.cut.push({ boss: true, faces: kind ? [`/assets/hud/busts/${kind}.webp`] : [], seal: '鬼', kanji: '鬼', shout: 'BOSS ARRIVES!',
          sub: [boss.name, def?.title].filter(Boolean).join(' · ').toUpperCase(), tag: `WAVE ${city.wave} BOSS`, tagLine: 'HOLD THE GATE' });
      }
    } else this.bossKey = '';
    this.fundsShown.set(!(active && preparing));
    if (city.points !== this.shownPoints) { this.shownPoints = city.points; this.fundsText.set(`◈ ${grouped.format(city.points)} SHARED`); }

    const progress = seat?.progress;
    if (progress && active) {
      const note = levelNote(progress, now);
      this.star.set(progress.level, progress.xp / Math.max(1, progress.next), note === 'HEALTH RESTORED' ? 'heal' : note.startsWith('LEVEL UP') ? 'up' : '');
    } else this.star.hide();

    const hotLanes = this.alerts(city, now, active);
    this.team(v, snapshot, self.id, now, hotLanes);
    this.challenge(city, now, preparing, active);
    this.emergency(city, snapshot, now, active);

    this.lane?.setCritical(active && !self.alive);

    const nearShop = active && self.alive && Math.hypot(self.x - VILLAGE.shop.x, self.z - VILLAGE.shop.z) <= VILLAGE.shop.radius && Math.abs(self.y) < 3;
    let role = '';
    if (active && self.alive && !nearShop && self.target && city.specialists) for (const s of city.specialists) if (s.id === self.target) role = s.role;
    const counter = COUNTER[role] ?? '';
    const coach = (nearShop || !!counter) && !!this.lane?.coachShowing();
    this.shopShown.set(!nearShop || coach);
    this.counterShown.set(!counter || coach); if (counter) this.counterText.set(counter);
    if (nearShop) {
      const key = `${f.input}:${f.family}:${city.points}`;
      if (key !== this.shopKey) { this.shopKey = key; this.shopMarkup.set(prompt('interact', 'QUARTERMASTER', { device: f.input, family: f.family, detail: `◈ ${grouped.format(city.points)} SHARED` })); }
    }

    const chapter = city.chapter;
    if (active && chapter && city.phase === 'assault' && city.wave === (chapter.number - 1) * 10 + 1 && this.bannerChapter !== chapter.number) {
      this.bannerChapter = chapter.number; this.bannerUntil = f.now + BANNER_MS;
      this.bannerKicker.set(`CHAPTER ${chapter.number}`); this.bannerTitle.set(chapter.title);
      const commander = ENEMIES[chapter.commander]?.name;
      this.bannerLine.set(commander ? `${commander.toUpperCase()} AT WAVE ${chapter.lastWave}` : '');
    }
    this.bannerOn.set(f.now < this.bannerUntil);
    this.cut.tick(f.now);
  }

  unmount() { this.lane?.clear(); this.star?.remove(); this.cut?.clear(); this.allies = []; this.rosterKey = ''; this.spans.clear(); }

  private seatOf(v: ObjectiveView, id: string) { for (const seat of v.seats) if (seat.id === id) return seat; return undefined; }

  private village(city: NonNullable<ObjectiveView['village']>) {
    const share = (id: string) => { for (const s of city.structures ?? []) if (s.id === id) return s.hp / Math.max(1, s.maxHp); return -1; };
    const total = city.hp / Math.max(1, city.maxHp), w = share('village-west'), g = share('village-keep'), e = share('village-east');
    this.torii.set(w < 0 ? total : w, g < 0 ? total : g, e < 0 ? total : e);
  }

  private team(v: ObjectiveView, snapshot: GameSnapshot, ownId: string, now: number, hot: ReadonlySet<number>) {
    let key = '';
    for (const seat of v.seats) if (seat.id !== ownId && seat.team === 'defenders') key += `${seat.id}:${seat.fighter}|`;
    if (key !== this.rosterKey) {
      this.rosterKey = key; this.allies = [];
      for (const seat of v.seats) if (seat.id !== ownId && seat.team === 'defenders') this.allies.push(seat.id);
      this.squad.roster(this.allies.length);
      this.squad.root.dataset.count = String(this.allies.length);
    }
    this.allies.forEach((id, i) => {
      const seat = this.seatOf(v, id); if (!seat) return;
      const p = playerOf(snapshot, seat.id), down = seat.down || !p?.alive;
      const reviving = down && (seat.rescue > 0 || seat.reviveAt !== undefined);
      const lane = seat.duty?.role === 'intercept' ? seat.duty.lane ?? 1 : -1;
      this.squad.set(i, { fighter: seat.fighter, share: down ? seat.rescue : (p?.hp ?? 0) / Math.max(1, p?.maxHp ?? 1), down, reviving, gone: !!seat.disconnected,
        returning: seat.reviveAt !== undefined ? seat.reviveAt - now : undefined,
        road: seat.duty?.role === 'rescue' ? '救' : lane >= 0 ? ROAD_KANJI[lane] : '', hot: lane >= 0 && hot.has(lane) });
      const tile = this.squad.root.children[i] as HTMLElement | undefined;
      if (tile && tile.title !== nameOf(seat)) tile.title = nameOf(seat);
    });
  }

  private challenge(city: NonNullable<ObjectiveView['village']>, _now: number, _preparing: boolean, active: boolean) {
    const goal = city.challenge;
    if (!active || goal?.state !== 'active') return;
    const key = `${goal.wave}:${goal.kind}`;
    if (key === this.cutQuest) return;
    this.cutQuest = key;
    const plural = goal.target === 1 ? '' : 'S';
    const sub = goal.kind === 'leaders' ? `DEFEAT ${goal.target} LEADER${plural} IN ${clockOf(90)}` : goal.kind === 'swift' ? `CLEAR THE WAVE IN ${clockOf(goal.target)}`
      : goal.kind === 'bulwark' ? `LET LESS THAN ${grouped.format(goal.target)} DAMAGE THROUGH` : goal.kind === 'rescue' ? 'SECURE THE RESCUE WAGON' : 'RECOVER THE CONVOY';
    this.cut.push({ seal: SEAL[goal.kind] ?? '令', kanji: '令', shout: 'NEW CHALLENGE!', sub, tag: goal.title, tagLine: `+${goal.reward} TEAM SUPPLIES ON CLEAR` });
  }

  private emergency(city: NonNullable<ObjectiveView['village']>, snapshot: GameSnapshot, now: number, active: boolean) {
    const e = city.emergency, up = active && !!e && e.endsAt > now;
    if (!up || !e) { this.optional.hide(); return; }
    const done = e.phase !== 'active', carrier = e.carrier ? playerOf(snapshot, e.carrier) : undefined;
    const key = `emergency-${e.id}`, seconds = Math.max(0, e.endsAt - now);
    const span = Math.max(this.spans.get(key) ?? 0, seconds); this.spans.set(key, span);
    const title = e.kind === 'rescue' ? 'EVACUATE THE WAGON' : 'RAID THE SUPPLY CONVOY', road = e.x < 0 ? 'WEST' : 'EAST';
    const line = done ? (e.phase === 'secured' ? `SECURED · +${e.reward} SHARED` : 'OPPORTUNITY MISSED')
      : carrier?.alive ? 'DEFEAT THE MARKED CARRIER' : `${road} ROAD · ${e.contested ? 'CLEAR THE RAIDERS' : e.helpers.length ? `SECURING ${Math.round(e.progress * 100)}%` : `STAND BY THE ${e.kind === 'rescue' ? 'WAGON' : 'CARGO'}`}`;
    this.optional.set({ key, title, line, state: done ? (e.phase === 'secured' ? 'secured' : 'missed') : 'active', ring: done ? (e.phase === 'secured' ? 1 : 0) : seconds / Math.max(1, span),
      centre: done ? (e.phase === 'secured' ? '✓' : '✕') : clockOf(Math.ceil(seconds)), reward: `+${e.reward} ◈`, urgent: !done && seconds <= 10 });
    if (!done && e.id !== this.cutOptional) {
      this.cutOptional = e.id;
      this.cut.push({ seal: e.kind === 'rescue' ? '救' : '補', kanji: '急', shout: 'OPTIONAL QUEST!', sub: `${road} ROAD · ${clockOf(Math.ceil(seconds))} TO ACT`, tag: title, tagLine: `+${e.reward} SHARED` });
    }
  }

  private alerts(city: NonNullable<ObjectiveView['village']>, now: number, active: boolean): Set<number> {
    const hot = new Set<number>(), list: Alert[] = [];
    if (active && city.phase === 'assault') {
      const first = struckStructure(city.structures, now), second = first ? struckStructure(city.structures, now, first) : undefined;
      for (const s of [first, second]) if (s) { const lane = LANE_OF[s.id] ?? 1; list.push({ lane, raiders: city.lanes?.[lane] ?? 0, hot: true, rank: 3, x: s.x, z: s.z }); }
      for (const p of city.pressure ?? []) if (p.level >= 2) list.push({ lane: p.lane, raiders: p.targets.length, hot: p.level === 3, rank: p.level === 3 ? 2 : 1, x: p.x, z: p.z });
      const surge = city.director?.state === 'surge' ? city.director.lane : -1, road = LANES[surge];
      if (road) list.push({ lane: surge, raiders: city.lanes?.[surge] ?? 0, hot: false, rank: 0, x: road.x * .55, z: (road.z + VILLAGE.z) * .5 });
    }
    const sides: Record<'left' | 'right', Alert | undefined> = { left: undefined, right: undefined }, raiders = { left: new Map<number, number>(), right: new Map<number, number>() };
    for (const a of list) {
      hot.add(a.lane);
      const side = sideOf(a.x, 1.5, a.z, a.lane === 2 ? 1 : -1) < 0 ? 'left' : 'right';
      raiders[side].set(a.lane, Math.max(raiders[side].get(a.lane) ?? 0, a.raiders));
      const best = sides[side]; if (!best || a.rank > best.rank) sides[side] = a;
    }
    for (const side of ['left', 'right'] as const) {
      const a = sides[side];
      if (!a) { this.inks[side].hide(); continue; }
      let total = 0; for (const n of raiders[side].values()) total += n;
      this.inks[side].show(ROAD_KANJI[a.lane] ?? '西', total, [...list].some(b => b.hot && (sideOf(b.x, 1.5, b.z, b.lane === 2 ? 1 : -1) < 0) === (side === 'left')));
    }
    return hot;
  }
}
