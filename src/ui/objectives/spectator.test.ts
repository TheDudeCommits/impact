import {describe,it,expect} from 'vitest';
import {squadSubject} from './spectator';
import type {PlayerState} from '../../game/types';
const player=(id:string,team='heroes',alive=true)=>({id,team,alive} as PlayerState);
describe('objective squad spectating',()=>{
 it('cycles living allies, retains selection, replaces a fallen subject, and restores self on return',()=>{
  const self=player('self','heroes',false),a=player('a'),b=player('b'),foe=player('enemy','villains'),players=[self,foe,a,b];
  expect(squadSubject(players,self,null)).toBe('a');expect(squadSubject(players,self,'a',1)).toBe('b');
  expect(squadSubject(players,self,'b')).toBe('b');expect(squadSubject(players,self,'a',-1)).toBe('b');
  b.alive=false;expect(squadSubject(players,self,'b')).toBe('a');a.alive=false;expect(squadSubject(players,self,'b')).toBeNull();
  self.alive=true;expect(squadSubject(players,self,'a')).toBeNull();
 });
});
