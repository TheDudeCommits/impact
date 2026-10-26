import { isReleasedFighter } from '../rosterAvailability';
import type { ArenaSimulation } from '../simulation';
import type { CombatEvent, FighterId, PlayerInput } from '../types';
import { BODY_SIZE, MOVES } from '../moves';
import { HELD } from '../economy/fighters';

export type DummyBehaviour = 'passive' | 'combat' | 'guard' | 'after-hit' | 'playback' | 'punish';
export type LabCommand = { lab: 'opponent' | 'swap-self' | 'swap-opponent' | 'behaviour' | 'drill-move' | 'speed' | 'freeze' | 'step' | 'slot' | 'record' | 'stop' | 'play'; value?: unknown };
export interface LabView {
  behaviour: DummyBehaviour; speed: number; frozen: boolean; frame: number;
  slot: number; recording: boolean; frames: number; slots: number[]; cursor: number;
  drill: { move: 'heavy' | 'special'; attempts: number; successes: number; cue: string };
}
type Command = Omit<PlayerInput, 'seq'>;
const neutral = (yaw = 0): Command => ({ moveX: 0, moveZ: 0, yaw });
const MAX_FRAMES = 600;

export class TrainingLab {
  behaviour: DummyBehaviour = 'combat';
  speed = 1; frozen = false; recording = false; slot = 0; frame = 0;
  private budget = 0; private steps = 0; private cursor = 0;
  private readonly tapes: Command[][] = [[], [], []];
  private recorded: Command[] = [];
  private input: Command = neutral();
  private hit = false; private hitBaseline = 0; private nextDrill = 0; private armed = false; private drillReset = false;
  private drill: LabView['drill'] = { move: 'heavy', attempts: 0, successes: 0, cue: 'Perfect guard, then counter before the dummy recovers. Some moves are safe on an ordinary block.' };

  view(): LabView { return { behaviour: this.behaviour, speed: this.speed, frozen: this.frozen, frame: this.frame,
    slot: this.slot, recording: this.recording, frames: this.recording ? this.recorded.length : this.tapes[this.slot].length,
    slots: this.tapes.map(t => t.length), cursor: this.cursor, drill: { ...this.drill } }; }

  shouldStep() {
    if (this.frozen) { if (!this.steps) return false; this.steps--; }
    else { this.budget += this.speed; if (this.budget < 1) return false; this.budget -= 1; }
    this.frame++; return true;
  }
  capture(input: PlayerInput): PlayerInput {
    if (!this.recording) return input;
    this.input = { ...input, attack: input.attack ?? this.input.attack, jump: input.jump || this.input.jump,
      dash: input.dash || this.input.dash, awaken: input.awaken || this.input.awaken };
    return { ...neutral(input.yaw), seq: input.seq };
  }
  command(sim: ArenaSimulation, owner: string, raw: unknown): boolean {
    if (!raw || typeof raw !== 'object' || !('lab' in raw)) return false;
    const { lab, value } = raw as LabCommand;
    if (lab === 'opponent') {
      if (!isReleasedFighter(value) || HELD.has(value as FighterId)) return false;
      const bot = sim.actors.get('sparring-bot'); if (!bot) return false;
      bot.state.fighter = value as FighterId; bot.state.size = BODY_SIZE[value as FighterId];
      this.stop(); sim.trainingCommand(owner, 'reset'); return true;
    }
    if (lab === 'swap-self' || lab === 'swap-opponent') {
      const self = lab === 'swap-self';
      if (!isReleasedFighter(value) || !self && HELD.has(value)) return false;
      if (!sim.actors.has(self ? owner : 'sparring-bot') || sim.actors.get(owner)?.state.isBot) return false;
      if (this.recording) this.stop();
      if (!sim.swapFighter(self ? owner : 'sparring-bot', value)) return false;
      this.rearm(sim); return true;
    }
    if (lab === 'behaviour') {
      if (!['passive', 'combat', 'guard', 'after-hit', 'playback', 'punish'].includes(String(value))) return false;
      this.stop(); this.behaviour = value as DummyBehaviour; this.hit = false; this.armed = false; this.nextDrill = sim.serverTime + 1;
      this.hitBaseline = sim.getPlayer('sparring-bot')?.damageTaken ?? 0;
      sim.trainingBotMode = value === 'combat' ? 'combat' : 'passive';
      if (value === 'punish') { this.drill.attempts = this.drill.successes = 0; sim.trainingCommand(owner, 'reset'); }
    } else if (lab === 'drill-move') {
      if (value !== 'heavy' && value !== 'special') return false;
      this.drill.move = value; this.drill.attempts = this.drill.successes = 0; sim.trainingCommand(owner, 'reset');
    } else if (lab === 'speed') { if (![.25, .5, 1].includes(Number(value))) return false; this.speed = Number(value); this.budget = 0; }
    else if (lab === 'freeze') { this.frozen = value === true; this.steps = 0; this.budget = 0; }
    else if (lab === 'step') { this.frozen = true; this.steps = Math.min(5, this.steps + 1); }
    else if (lab === 'slot') { if (![0, 1, 2].includes(Number(value))) return false; this.stop(); this.slot = Number(value); }
    else if (lab === 'record') { this.stop(); sim.trainingCommand(owner, 'reset'); this.recorded = []; this.input = neutral(); this.recording = true; this.frozen = false; }
    else if (lab === 'stop') this.stop();
    else if (lab === 'play') { this.stop(); if (!this.tapes[this.slot].length) return false; sim.trainingCommand(owner, 'reset'); this.behaviour = 'playback'; }
    else return false;
    return true;
  }
  stop() {
    if (this.recording && this.recorded.length) this.tapes[this.slot] = this.recorded.map(f => ({ ...f }));
    this.recording = false; this.recorded = []; this.cursor = 0; this.input = neutral();
    if(this.behaviour==='playback')this.behaviour='passive';
  }
  resetPositions(sim: ArenaSimulation) {
    const human = [...sim.actors.values()].find(a => !a.state.isBot), bot = sim.actors.get('sparring-bot');
    if (!human || !bot) return;
    sim.place(human.state.id, { x: 0, y: 0, z: 3 }, Math.PI);
    sim.place(bot.state.id, { x: 0, y: 0, z: 0 }, 0);
    human.evadeUntil = bot.evadeUntil = 0;
    this.rearm(sim);
  }
  private rearm(sim: ArenaSimulation) {
    this.hit = false; this.hitBaseline = 0; this.armed = false; this.drillReset = false; this.cursor = 0; this.nextDrill = sim.serverTime + 1;
  }
  dummy(sim: ArenaSimulation, id: string): Command | undefined {
    if (id !== 'sparring-bot') return undefined;
    const bot = sim.actors.get(id)!, human = [...sim.actors.values()].find(a => !a.state.isBot);
    if (!human) return neutral();
    const yaw = Math.atan2(human.state.x - bot.state.x, human.state.z - bot.state.z);
    const base = { ...neutral(yaw), targetId: human.state.id, lock: true };
    if (this.recording) {
      const frame = { ...this.input, moveX:-this.input.moveX,moveZ:-this.input.moveZ,yaw:this.input.yaw+Math.PI,targetId:human.state.id,lock:true };
      this.recorded.push(frame); this.input = { ...this.input, attack: undefined, jump: false, dash: false, awaken: false };
      if (this.recorded.length >= MAX_FRAMES) this.stop();
      return frame;
    }
    if (this.behaviour === 'combat') return undefined;
    if (this.behaviour === 'playback') { const tape = this.tapes[this.slot]; return tape.length ? { ...tape[this.cursor++ % tape.length], targetId: human.state.id } : base; }
    if (this.behaviour === 'after-hit') this.hit ||= (bot.state.damageTaken ?? 0) > this.hitBaseline;
    if (this.behaviour === 'punish') {
      if (this.armed && !bot.cast && sim.serverTime >= bot.stunUntil) {
        this.armed = false; this.drill.cue = 'Guard recovered. Try a perfect guard or a faster answer.';
      }
      if (sim.serverTime >= this.nextDrill && !bot.cast && sim.serverTime >= bot.stunUntil) {
        if (this.drillReset) { sim.trainingCommand(human.state.id, 'reset'); return neutral(); }
        this.armed = false; this.drillReset = true;
        this.nextDrill = sim.serverTime + Math.max(4, MOVES[bot.state.fighter][this.drill.move].duration + 2);
        return { ...base, attack: this.drill.move };
      }
      return { ...base, guard: !bot.cast };
    }
    return { ...base, guard: this.behaviour === 'guard' || this.behaviour === 'after-hit' && this.hit };
  }
  event(event: Omit<CombatEvent, 'id' | 'serverTime'>) {
    if (this.behaviour !== 'punish') return;
    if (event.actorId === 'sparring-bot' && event.slot === this.drill.move && event.kind === 'cast') {
      this.drill.attempts++; this.drill.cue = 'Time your guard just before impact, then answer with a fast attack.';
    } else if (event.actorId === 'sparring-bot' && event.slot === this.drill.move && ['blocked', 'just-guard'].includes(event.kind)) {
      this.armed = true; this.drill.cue = event.kind === 'just-guard' ? 'Perfect guard! Turn and counter before recovery.' : 'Blocked. Test your fastest answer; a safe move may require a perfect guard.';
    } else if (event.actorId === 'sparring-bot' && event.kind === 'hit') {
      this.armed = false; this.drill.cue = 'Caught. Time your guard closer to impact on the next attempt.';
    } else if (this.armed && event.targetId === 'sparring-bot' && ['hit', 'blocked', 'just-guard'].includes(event.kind)) {
      this.armed = false;
      if (event.kind === 'hit') { this.drill.successes++; this.drill.cue = 'Punish landed. Repeat the timing.'; }
      else this.drill.cue = 'Guard recovered. Answer earlier or use a faster move.';
    }
  }
}
