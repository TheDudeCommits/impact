import { Group, Vector3 } from 'three';
import type { PlayerState } from '../game/types';
import type { Fighter } from '../render/Fighter';
import { threatInk, type ThreatInk, type ThreatSource } from '../render/ThreatOutline';
import { GF, GS, toMoveDefinition } from './horde/Horde';
import type { HordeFrame } from './horde/frame';
import { GRUNTS } from './horde/kinds';

const moves = GRUNTS.map(kind => kind.moves.map(toMoveDefinition));
interface Proxy { serial: number; threatInk: ThreatInk; state: PlayerState & ThreatSource; group: Group; distance: number }
const CAMERA_CROWD = 24;
export class SurvivalTargets {
  readonly players: PlayerState[] = [];
  readonly bodies = new Map<string, Proxy>();
  readonly glows = new Map<number, ThreatInk>();
  readonly crowd = new Map<string, Pick<Fighter, 'state' | 'group'>>();
  private pool: Proxy[] = [];
  private free: Proxy[] = [];
  private near: Proxy[] = [];
  private centre = new Vector3();
  update(players: readonly PlayerState[], frame: HordeFrame | undefined, self: PlayerState) {
    this.players.length = 0; this.players.push(...players);
    this.crowd.clear(); this.near.length = 0;
    for(const body of this.bodies.values())body.state.alive=false;
    if (frame) for (let i = 0; i < frame.n; i++) {
      const phase = frame.state[i], kind = GRUNTS[frame.kind[i]];
      if (!kind || phase === GS.FREE || phase === GS.SPAWN || phase === GS.DEAD || frame.hp[i] <= 0) continue;
      const dx = frame.x[i] - self.x, dz = frame.z[i] - self.z, distance = dx * dx + dz * dz;
      if (distance > 60 * 60) continue;
      const id=`g${frame.serial[i]}`;
      let body=this.bodies.get(id);
      if(!body){const slot=this.free.findIndex(b=>b.threatInk.mix.value===0);if(slot>=0)body=this.free.splice(slot,1)[0];}
      if(!body){body=this.make();this.pool.push(body);}
      const s = body.state, attacking = phase === GS.ATTACK || phase === GS.CHARGE;
      body.serial=frame.serial[i];this.glows.set(body.serial,body.threatInk);
      s.alive=true;s.id = id; s.name = kind.name; s.x = frame.x[i]; s.y = frame.y[i]; s.z = frame.z[i]; s.yaw = frame.yaw[i];
      s.hp = frame.hp[i]; s.maxHp = 1; s.size = kind.height / 1.8;
      s.action = attacking ? 'light' : phase === GS.DOWN ? 'knockdown' : phase === GS.GETUP ? 'getup' : phase === GS.AIR ? 'launched' : 'idle';
      s.actionDuration = Math.max(0, frame.span[i]); s.actionTime = s.actionDuration ? frame.phase[i] / s.actionDuration : 0;
      s.viewMove = moves[frame.kind[i]][frame.move[i]];
      s.grounded = phase !== GS.AIR; s.target = null;
      if (attacking && s.viewMove && distance <= (s.viewMove.range + 3) ** 2) {
        const facing = dx * -Math.sin(s.yaw) + dz * -Math.cos(s.yaw);
        if (facing >= Math.sqrt(distance) * .5) s.target = self.id;
      }
      s.guarding = !!kind.shield && !(frame.flags[i] & GF.BROKEN);
      body.distance = distance;
      body.group.position.set(s.x, s.y, s.z);
      this.players.push(s); this.bodies.set(s.id, body); this.near.push(body);
    }
    for(const [id,body] of this.bodies)if(!body.state.alive){this.bodies.delete(id);this.glows.delete(body.serial);this.free.push(body);}
    this.near.sort((a, b) => a.distance - b.distance);
    for (let i = 0; i < Math.min(CAMERA_CROWD, this.near.length); i++) this.crowd.set(this.near[i].state.id, this.near[i]);
    return this.players;
  }
  present(position: (id: string, out: Vector3) => Vector3 | undefined, target: string | null, pending: string | null) {
    for (const id of [target, pending]) { const body = id ? this.bodies.get(id) : undefined; if (body) this.crowd.set(id!, body); }
    for (const body of this.crowd.values()) if (this.bodies.has(body.state.id) && position(body.state.id, this.centre)) body.group.position.copy(this.centre);
  }
  body(id: string) { return this.bodies.get(id) as unknown as Fighter | undefined; }
  clear() { this.players.length = 0; this.bodies.clear(); this.glows.clear(); this.crowd.clear(); this.near.length = 0; this.pool.length = 0; this.free.length = 0; }
  get capacity() { return this.pool.length; }
  private make(): Proxy {
    return {serial: 0, threatInk: threatInk(), group: new Group(), distance: 0, state: {
      id: '', name: '', fighter: 'goku', enemy: 'compact-grunt', alive: true, isBot: true,
      x: 0, y: 0, z: 0, yaw: 0, hp: 1, maxHp: 1, stamina: 100, ultimate: 0,
      action: 'idle', actionStarted: 0, actionTime: 0, actionDuration: 0, target: null,
      grounded: true, guarding: false, cooldowns: {light: 0, heavy: 0, special: 0, ultimate: 0},
    }};
  }
}
