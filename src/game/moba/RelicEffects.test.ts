import {expect,it} from 'vitest';
import {RelicEffects} from './RelicEffects';
import {RiftMatch} from './RiftMatch';
import type {CombatEvent} from '../types';
it('rewards confirmed manual play once per cooldown and never gives passive attacks',()=>{
 const game=new RiftMatch({fillBots:false});const seat=game.add('h','goku','Hero');const p=game.sim.actors.get('h')!.state;
 seat.inventory=['sunbreaker','storm-crown','infinite-script','worldheart'];p.hp=300;
 const effects=new RelicEffects(),hit:CombatEvent={id:1,kind:'hit',actorId:'h',targetId:'v',slot:'special',serverTime:10,damage:100};
 expect(effects.observe({...hit,kind:'cast'},seat,p,10)).toBeUndefined();
 expect(effects.observe({...hit,kind:'blocked'},seat,p,10)).toBeUndefined();
 expect(effects.observe(hit,seat,p,10)).toMatchObject({ultimate:8,awakening:8,stamina:22,heal:120,surge:true});
 expect(effects.observe({...hit,targetId:'another-grunt'},seat,p,10)).toBeUndefined();
 expect(effects.observe(hit,seat,p,14)).toMatchObject({ultimate:8,awakening:0,heal:0,surge:false});
 expect(effects.surgeUntil.get('h')).toBe(13);p.alive=false;expect(effects.observe(hit,seat,p,30)).toBeUndefined();game.dispose();
});
it('perfect-parry restoration belongs to the defender and has an enforced cooldown',()=>{
 const game=new RiftMatch({fillBots:false});const seat=game.add('h','goku','Hero');seat.inventory=['aegis-of-dawn'];const p=game.sim.actors.get('h')!.state,effects=new RelicEffects();
 const e:CombatEvent={id:1,kind:'just-guard',actorId:'enemy',targetId:'h',serverTime:4,damage:90};
 expect(effects.observe(e,seat,p,4)).toMatchObject({heal:150,stamina:18});expect(effects.observe(e,seat,p,5)).toBeUndefined();
 expect(effects.observe({...e,actorId:'h',targetId:'enemy'},seat,p,10)).toBeUndefined();game.dispose();
});
it('gates mythics by level, consumes ancestor investment and blocks rebuying obsolete components',()=>{
 const game=new RiftMatch({fillBots:false});const seat=game.add('h','goku','Hero');game.add('v','dio','Enemy');game.start();for(let i=0;i<190;i++)game.step();seat.gold=5000;
 expect(game.buy('h','spirit-blade')).toBeUndefined();const before=seat.gold;
 expect(game.buy('h','sunbreaker')).toContain('level 8');expect(seat.gold).toBe(before);
 seat.level=8;expect(game.buy('h','sunbreaker')).toBeUndefined();expect(before-seat.gold).toBe(2800);expect(seat.inventory).toEqual(['sunbreaker']);
 expect(game.buy('h','spirit-blade')).toContain('upgraded');expect(game.buy('h','void-edge')).toContain('upgraded');game.dispose();
});
