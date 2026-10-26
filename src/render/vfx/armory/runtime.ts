import type * as THREE from 'three';
import { ARMORY_MANIFEST } from './vendor/manifest';
import { ArmoryHost } from './host';
import { ArmoryEffectType, type ArmoryParams } from './effect';
import { armorySound, soundBank } from './sound';

export const vendored = (id: string) => Object.hasOwn(ARMORY_MANIFEST, id);

export async function armoryTypes(scene: THREE.Scene, ids: readonly string[], capacity: (id: string) => number) {
  const host = ArmoryHost.for(scene);
  const mine = host.types as Map<string, ArmoryEffectType>;
  const out: ArmoryEffectType[] = [];
  for (const id of ids) {
    let type = mine.get(id);
    if (!type) {
      const entry = ARMORY_MANIFEST[id];
      if (!entry) continue;
      const Klass = await entry.load();
      type = mine.get(id);
      if (!type) {
        type = new ArmoryEffectType(host, id, Klass, capacity(id));
        mine.set(id, type);
        type.prewarm(scene);
      }
    }
    out.push(type);
  }
  return { host, types: out };
}

export function prepareSound(track: { readonly cues: readonly { readonly type: string; readonly params?: unknown }[]; readonly body?: { readonly effect: string; readonly params: ArmoryParams } }) {
  const bank = soundBank();
  for (const cue of track.cues) {
    const mode = (cue.params as ArmoryParams | undefined)?.sound;
    if (mode && cue.type.startsWith('armory/')) bank.need(cue.type.slice('armory/'.length), mode);
  }
  if (track.body?.params.sound) bank.need(track.body.effect, track.body.params.sound);
  return bank.prepare();
}

export async function readySound(cap = 3000, current: () => boolean = () => true) {
  const bank = soundBank(), until = performance.now() + cap;
  bank.rushing++;
  try {
    await Promise.race([bank.prepare(), new Promise<void>(done => setTimeout(done, cap))]);
    const player = armorySound();
    if (!player) return;
    while (current() && performance.now() < until) {
      player.bank.pump(player.out);
      if (player.bank.settled(player.out)) return;
      await new Promise<void>(done => setTimeout(done, 40));
    }
  } finally { bank.rushing--; }
}

export function pumpSound() {
  const player = armorySound();
  player?.bank.pump(player.out);
}
