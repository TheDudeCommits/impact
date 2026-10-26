import * as THREE from 'three';
import type { Fighter } from '../../Fighter';
import type { VfxKit } from '../VfxKit';
import { ORIENT, SPRITE } from '../SparkField';

export type MoteKind = 'glint' | 'ember' | 'sand' | 'gloom' | 'spray' | 'petal' | 'frost' | 'bubble' | 'pop' | 'steam' | 'flame' | 'ripple' | 'rubble';

export const MOTE_EVERY: Record<MoteKind, number> = { glint: .075, ember: .06, sand: .06, gloom: .09, spray: .08, petal: .1, frost: .09, bubble: .07, pop: .075, steam: .05, flame: .028, ripple: .16, rubble: .3 };
const TAU = Math.PI * 2;
const _tip = new THREE.Vector3();
const MAN = 1.6;
function giant(fighter: Fighter) {
  const head = fighter.drawnJoint?.('Head');
  if (!head) return 1;
  const times = (head.getWorldPosition(_tip).y - fighter.group.position.y) / MAN;
  return times >= 1.5 ? Math.min(3, times) : 1;
}

export function emitMote(kit: VfxKit, kind: MoteKind, fighter: Fighter, time: number, strength: number, core: number, rim: number) {
  const p = fighter.group.position, a = Math.random() * TAU, c = Math.cos(a), s = Math.sin(a);
  if (kind === 'glint') {
    const sp = kit.sparks.spec, r = .25 + Math.random() * .45, size = (.16 + Math.random() * .2) * (.5 + .5 * strength);
    sp.reset(SPRITE.flare, time, .16 + Math.random() * .14).pos(p.x + c * r, p.y + .3 + Math.random() * 1.5, p.z + s * r).sized(size * .5, size, .25);
    sp.hot(core, 1.9 * strength).cool(rim, 0); sp.bias = .3; kit.sparks.emit();
    if (Math.random() < .3) {
      sp.reset(SPRITE.streak, time, .12 + Math.random() * .08).pos(p.x + c * r, p.y + .4 + Math.random() * 1.3, p.z + s * r).velocity(c * 9, (Math.random() - .3) * 3, s * 9);
      sp.orient = ORIENT.velocity; sp.sized(.022, .008, .5); sp.stretch = 6; sp.trail = .06; sp.hot(0xffffff, 2 * strength).cool(rim, 0); kit.sparks.emit();
    }
  } else if (kind === 'ember') {
    const sp = kit.sparks.spec, hand = Math.random() < .5 ? fighter.handR : fighter.handL;
    sp.reset(SPRITE.streak, time, .4 + Math.random() * .3).pos(hand.x + c * .08, hand.y + (Math.random() - .5) * .12, hand.z + s * .08).velocity(c * .5, .6 + Math.random() * .8, s * .5);
    sp.orient = ORIENT.velocity; sp.sized(.04, .015, .6); sp.stretch = 1.6; sp.trail = .03; sp.gravity = 7; sp.drag = .6; sp.hot(core, 2.1 * strength).cool(rim, .35); kit.sparks.emit();
    if (Math.random() < .22) kit.smoke(hand.x, hand.y + .12, hand.z, c * .15, .7, s * .15, .2, time, .45, 0x6a4a3c, 0x1c1210);
  } else if (kind === 'sand') {
    const sp = kit.dust.spec, r = .35 + Math.random() * .45, size = .1 + Math.random() * .1, turn = 1.6 + Math.random() * 1.2;
    sp.reset(SPRITE.puff, time, .4 + Math.random() * .25).pos(p.x + c * r, p.y + .1 + Math.random() * .8, p.z + s * r).velocity(-s * turn + c * .2, .25 + Math.random() * .4, c * turn + s * .2);
    sp.drag = 1.2; sp.gravity = -.2; sp.sized(size * .5, size, .5).hot(core, 1).cool(rim, .7 * strength); sp.bias = size * .5; kit.dust.emit();
  } else if (kind === 'gloom') {
    const sp = kit.dust.spec, r = .2 + Math.random() * .3, size = .16 + Math.random() * .12;
    sp.reset(SPRITE.puff, time, .5 + Math.random() * .3).pos(p.x + c * r, p.y + .9 + Math.random() * .9, p.z + s * r).velocity(c * .25, .5 + Math.random() * .5, s * .25);
    sp.drag = 1; sp.gravity = -.3; sp.sized(size * .5, size, .6).hot(0x2a1838, 1).cool(0x05020a, .72 * strength); sp.bias = size * .3; kit.dust.emit();
  } else if (kind === 'spray') {
    const sp = kit.sparks.spec, hand = Math.random() < .5 ? fighter.handR : fighter.handL;
    sp.reset(SPRITE.streak, time, .35 + Math.random() * .2).pos(hand.x, hand.y, hand.z).velocity(c * (1 + Math.random() * 1.4), 1 + Math.random() * 1.6, s * (1 + Math.random() * 1.4));
    sp.orient = ORIENT.velocity; sp.sized(.03, .012, .6); sp.stretch = 2.2; sp.trail = .05; sp.gravity = 8; sp.drag = .5; sp.hot(core, 1.5 * strength).cool(rim, .3); kit.sparks.emit();
  } else if (kind === 'petal' || kind === 'frost') {
    const sp = kit.sparks.spec, r = .3 + Math.random() * .7, size = kind === 'petal' ? .05 + Math.random() * .04 : .035 + Math.random() * .035;
    sp.reset(SPRITE.shard, time, .8 + Math.random() * .5).pos(p.x + c * r, p.y + .5 + Math.random() * 1.6, p.z + s * r).velocity(-s * .5 + c * .15, -.25 - Math.random() * .3, c * .5 + s * .15);
    sp.sized(size, size * .8, .3).hot(core, 2.2 * strength).cool(rim, .85 * strength); sp.spin = (Math.random() - .5) * 9; sp.rotation = Math.random() * TAU; sp.drag = .4; kit.sparks.emit();
  } else if (kind === 'bubble') {
    const sp = kit.sparks.spec, r = .22 + Math.random() * .22, size = .05 + Math.random() * .05;
    sp.reset(SPRITE.core, time, .45 + Math.random() * .3).pos(p.x + c * r, p.y + .25 + Math.random() * 1.4, p.z + s * r).velocity(c * .15, .7 + Math.random() * .7, s * .15);
    sp.sized(size, size * .5, .8).hot(core, 1.5 * strength).cool(rim, 0); sp.bias = .15; kit.sparks.emit();
  } else if (kind === 'pop') {
    const sp = kit.sparks.spec, hand = Math.random() < .5 ? fighter.handR : fighter.handL, size = .22 + Math.random() * .2;
    sp.reset(SPRITE.star, time, .14 + Math.random() * .08).pos(hand.x + c * .16, hand.y + (Math.random() - .3) * .26, hand.z + s * .16).sized(size * .5, size, .3);
    sp.hot(core, 1.9 * strength).cool(rim, .6); sp.bias = .3; kit.sparks.emit();
    if (Math.random() < .35) kit.smoke(hand.x, hand.y + .1, hand.z, c * .4, .9, s * .4, .16, time, .35, 0x8a7868, 0x2a2420);
    sp.reset(SPRITE.streak, time, .22).pos(hand.x, hand.y, hand.z).velocity(c * 2.4, 1 + Math.random() * 2, s * 2.4);
    sp.orient = ORIENT.velocity; sp.sized(.02, .008, .5); sp.stretch = 3; sp.trail = .04; sp.gravity = 6; sp.hot(0xffffff, 1.8 * strength).cool(rim, 0); kit.sparks.emit();
  } else if (kind === 'steam') {
    const tall = giant(fighter);
    const sp = kit.dust.spec, r = (.18 + Math.random() * .25) * tall, size = (.13 + Math.random() * .09) * (tall > 1 ? 1.3 : 1);
    sp.reset(SPRITE.puff, time, .32 + Math.random() * .18).pos(p.x + c * r, p.y + (.7 + Math.random() * 1) * tall, p.z + s * r).velocity(c * .3, 1.8 + Math.random() * 1.2, s * .3);
    sp.drag = 1.6; sp.gravity = -.8; sp.sized(size * .5, size, .5).hot(core, 1).cool(rim, .7 * strength); sp.bias = size * .4; kit.dust.emit();
    if (tall === 1 && Math.random() < .6) {
      const wind = kit.sparks.spec, out = .45 + Math.random() * .5, turn = 5 + Math.random() * 3;
      wind.reset(SPRITE.streak, time, .2 + Math.random() * .12).pos(p.x + c * out, p.y + .06 + Math.random() * .5, p.z + s * out).velocity(-s * turn, .3, c * turn);
      wind.orient = ORIENT.velocity; wind.sized(.03, .012, .5); wind.stretch = 6; wind.trail = .07; wind.hot(core, 1.1 * strength).cool(rim, .2); kit.sparks.emit();
    }
  } else if (kind === 'ripple') {
    const sp = kit.sparks.spec, r = .35 + Math.random() * .35, size = .14 + Math.random() * .16;
    sp.reset(SPRITE.ring, time, .3 + Math.random() * .15).pos(p.x + c * r, p.y + .5 + Math.random() * 1.2, p.z + s * r).sized(size * .3, size, .7);
    sp.hot(core, 1.4 * strength).cool(rim, .1); sp.bias = .2; kit.sparks.emit();
    const head = fighter.drawnJoint?.('Head');
    if (head) head.getWorldPosition(_tip); else _tip.set(p.x, p.y + 1.7, p.z);
    sp.reset(SPRITE.ring, time, .4).pos(_tip.x, _tip.y + .45, _tip.z).sized(.44, .5, .2).hot(core, 2.4 * strength).cool(rim, .2);
    sp.orient = ORIENT.plane; sp.axis(0, 1, 0); kit.sparks.emit();
  } else if (kind === 'rubble') {
    if (fighter.state.grounded !== false) kit.debris.lift(1 + (Math.random() < .4 ? 1 : 0), p.x, p.z, .6, 1.5, .05, p.y, 1.5, 1.6);
    const sp = kit.sparks.spec, r = .3 + Math.random() * .5;
    sp.reset(SPRITE.core, time, .4).pos(p.x + c * r, p.y + .2 + Math.random() * 1.5, p.z + s * r).velocity(0, .8, 0).sized(.05, .025, .8).hot(core, 1.4 * strength).cool(rim, 0); kit.sparks.emit();
  } else if (kind === 'flame') {
    const sp = kit.sparks.spec, k = .15 + Math.random() * .85, tip = fighter.strikePoint(_tip), hand = fighter.handR;
    const x = hand.x + (tip.x - hand.x) * k, y = hand.y + (tip.y - hand.y) * k, z = hand.z + (tip.z - hand.z) * k;
    sp.reset(SPRITE.streak, time, .2 + Math.random() * .16).pos(x, y, z).velocity(c * .5, 1.8 + Math.random() * 1.6, s * .5);
    sp.orient = ORIENT.velocity; sp.sized(.1, .028, .45); sp.stretch = 2.8; sp.trail = .05; sp.drag = 1.2; sp.hot(core, 2 * strength).cool(rim, .3); kit.sparks.emit();
    if (Math.random() < .45) { sp.reset(SPRITE.glow, time, .2).pos(x, y, z).sized(.3, .16, .4).hot(core, 1 * strength).cool(rim, 0); kit.sparks.emit(); }
  }
}
