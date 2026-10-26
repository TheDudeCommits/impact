import {describe,it,expect} from 'vitest';
import {RiftAssets} from './RiftAssets';
import {RiftMatch} from './RiftMatch';
describe('Rift assets across visibility boundaries',()=>{
 it('retains the drafted roster and outfit identity when an enemy leaves vision',()=>{
  const g=new RiftMatch({fillBots:false});try{g.add('h','goku','Hero');g.add('v','dio','Villain');const all=g.snapshot();all.players.find(p=>p.id==='v')!.outfit='ink-dio';const assets=new RiftAssets(),initial=assets.key(all),fog={...all,players:all.players.filter(p=>p.id==='h')};expect(assets.ids(fog)).toEqual(['goku','dio']);expect(assets.key(fog)).toBe(initial);expect(assets.key(all)).toBe(initial);all.players.find(p=>p.id==='v')!.outfit='new-outfit';expect(assets.key(all)).not.toBe(initial);expect(assets.key(fog)).toBe(assets.key(all));}finally{g.dispose();}
 });
 it('forgets departed seats and prior-round looks without retaining another match',()=>{
  const g=new RiftMatch({fillBots:false});try{g.add('h','goku','Hero');g.add('v','dio','Villain');const all=g.snapshot(),assets=new RiftAssets();all.players[1].outfit='old-look';assets.key(all);const next={...all,players:[all.players[0]],rift:{...all.rift,seats:[all.rift.seats[0]],round:2}};expect(assets.ids(next)).toEqual(['goku']);expect(assets.key(next)).not.toContain('old-look');assets.clear();expect(assets.key(next)).not.toContain('dio');}finally{g.dispose();}
 });
});
