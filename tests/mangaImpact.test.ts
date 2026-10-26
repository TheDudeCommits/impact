import { describe, expect, it } from 'vitest';
import { ACCENT_THROTTLE, accentSlot, mangaImpactProfile } from '../src/ui/MangaImpact';
import type { CombatEvent } from '../src/game/types';
const base:CombatEvent={id:1,kind:'hit',actorId:'a',targetId:'b',serverTime:1,slot:'light'};
describe('manga contact presentation',()=>{
  it('does not imply a hit on cast, release or rejected/whiff events',()=>{
    for(const kind of ['cast','release','rejected','dodge'] as const)expect(mangaImpactProfile({...base,kind})).toBeNull();
  });
  it('prints the two moments that are not a blow landing',()=>{
    expect(mangaImpactProfile({...base,kind:'just-guard'})?.guarded).toBe(true);
    expect(mangaImpactProfile({...base,kind:'break'})?.strength).toBe(1);
  });
  it('keeps guarded contact small and separates special from ultimate accents',()=>{
    expect(mangaImpactProfile({...base,kind:'blocked',slot:'ultimate'})?.strength).toBe(0);
    const special=mangaImpactProfile({...base,slot:'special'})!,ultimate=mangaImpactProfile({...base,slot:'ultimate'})!;
    expect(ultimate.size).toBeGreaterThan(special.size);expect(ultimate.duration).toBeLessThan(.5);
  });
  it('lets a finisher take the accent from a jab thrown a frame earlier',()=>{
    expect(accentSlot(3,0,1)).toBe('free');
    expect(accentSlot(3,1,ACCENT_THROTTLE*.8)).toBe('preempt');
    expect(accentSlot(1,3,ACCENT_THROTTLE*.8)).toBe('held');
    expect(accentSlot(2,2,ACCENT_THROTTLE*.8)).toBe('held');
  });
});
