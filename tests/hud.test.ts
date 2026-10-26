import {describe,it,expect} from 'vitest';
import {placeMarker,rankPlayers,resultTitle} from '../src/ui/hudMath';
import type {PlayerState} from '../src/game/types';
import {cardsHtml} from '../src/ui/hud/inked';
import {actionName} from '../src/input/glyphs';
import {MOVE_ACTIONS} from '../src/input/bindings';
const p=(id:string,extras:Partial<PlayerState>={}):PlayerState=>({id,name:id,fighter:'goku',x:0,y:0,z:0,yaw:0,hp:0,maxHp:1000,stamina:100,ultimate:0,action:'defeated',actionStarted:0,actionTime:0,actionDuration:0,target:null,alive:false,isBot:false,grounded:true,guarding:false,cooldowns:{light:0,heavy:0,special:0,ultimate:0},...extras});
describe('the lock reticle at the viewport edge',()=>{
 it('leaves a target inside the frame where it projects',()=>{expect(placeMarker(500,300,true,1000,600,60)).toMatchObject({x:500,y:300,offscreen:false});});
 it('pins a target outside the frame to the edge on its bearing',()=>{
  const right=placeMarker(1400,300,true,1000,600,60);
  expect(right.offscreen).toBe(true);expect(right.x).toBeCloseTo(940);expect(right.y).toBeCloseTo(300);expect(right.angle).toBeCloseTo(0);
  const up=placeMarker(500,-200,true,1000,600,60);expect(up.x).toBeCloseTo(500);expect(up.y).toBeCloseTo(60);expect(up.angle).toBeCloseTo(-Math.PI/2);
  const diagonal=placeMarker(2500,1300,true,1000,600,60);expect(diagonal.x).toBeCloseTo(940);expect(diagonal.y).toBeCloseTo(520);
  expect(placeMarker(30,300,true,1000,600,60).offscreen,'the margin band counts as outside').toBe(true);
 });
 it('mirrors a projection from behind the camera back to the true side',()=>{
  const behind=placeMarker(200,300,false,1000,600,60);expect(behind.offscreen).toBe(true);expect(behind.x).toBeCloseTo(940);
  const centred=placeMarker(500,300,false,1000,600,60);expect(centred.offscreen).toBe(true);expect(centred.y).toBeCloseTo(540);
 });
});
describe('placings on the results screen',()=>{
 it('puts the winner first, then the fallen in reverse order of falling',()=>{
  const list=[p('a'),p('b'),p('w',{alive:true,hp:400}),p('c')];
  expect(rankPlayers(list,'w',['a','c','b']).map(x=>x.id)).toEqual(['w','b','c','a']);
 });
 it('ranks a fall it never saw after the ones it did, by damage dealt',()=>{
  const list=[p('x',{damageDealt:40}),p('y',{damageDealt:900}),p('z',{damageDealt:400}),p('w',{alive:true,hp:1})];
  expect(rankPlayers(list,'w',['z']).map(x=>x.id)).toEqual(['w','z','y','x']);
  expect(rankPlayers(list,null,[]).map(x=>x.id),'no winner and no record is damage order').toEqual(['w','y','z','x']);
  expect(list.map(x=>x.id),'the snapshot is left alone').toEqual(['x','y','z','w']);
 });
 it('names the local outcome',()=>{
  expect(resultTitle('me',true,'me')).toBe('LAST FIGHTER STANDING');
  expect(resultTitle('me',false,'w')).toBe('ELIMINATED');
  expect(resultTitle('me',true,null)).toBe('MATCH COMPLETE');
 });
});
describe('the move cards (Halo and Inked draw the same markup)',()=>{
 const html=cardsHtml(['LIGHT','HEAVY','SPECIAL','ULTIMATE','AREA'],['J','K','Q','R','G','E']);
 const cards=[...html.matchAll(/<div class="move-slot ik-card[^"]*"(?: data-move="(\d)")?(?: id="([\w-]+)")?>(.*?)<\/div>/g)];
 it('are five moves and AWAKENING: the AREA card (data-move 4) stands with the cooled moves, before the ULTIMATE',()=>{
  expect(cards.map(([,move,id])=>move??id)).toEqual(['0','1','2','4','3','awakening-card']);
  expect(cards.map(([,,id])=>id)).toEqual([undefined,undefined,undefined,'area-card','ultimate-card','awakening-card']);
  expect(cards.map(([,,,body])=>/<kbd>(.*?)<\/kbd>/.exec(body)![1])).toEqual(['J','K','Q','G','R','E']);
 });
 it('give the AREA card its name, its key, a cooldown sweep and a reticle in place of a sheet panel',()=>{
  const [,,,area]=cards[3];
  expect(area).toContain('<strong class="ik-cap">AREA</strong>');expect(area).toContain('<b class="ik-num ik-cool"></b>');
  expect(area).toContain('ik-art ik-glyph');expect(area).not.toContain('--art-x');expect(area).not.toContain('ik-charge');
  expect(cards[3][0]).not.toContain(' charged');
 });
 it('name the cards\' pad buttons: ULTIMATE L2, AREA R2, AWAKEN both together',()=>{
  expect(MOVE_ACTIONS).toEqual(['light','heavy','special','ultimate','area','awaken']);
  expect(MOVE_ACTIONS.map(a=>actionName(a,'playstation'))).toEqual(['□','△','R1','L2','R2','L2+R2']);
  expect(MOVE_ACTIONS.map(a=>actionName(a,'xbox'))).toEqual(['X','Y','RB','LT','RT','LT+RT']);
  expect(actionName('awaken','generic')).toBe('LT+RT / L2+R2');
 });
});
