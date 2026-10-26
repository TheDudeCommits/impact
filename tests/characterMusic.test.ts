import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterMusic } from '../src/audio/CharacterMusic';

vi.mock('../src/audio/musicTracks', () => {
  const t = (id:string,series='dragon-ball') => ({id,series,title:id,artist:'Pack',category:'score',url:`/assets/music/${id}.m4a`});
  return { selectMusicTracks:(fighter:string,_opponent:string|undefined,phase:string) => {const rows=fighter==='missing'?[]:phase==='lobby'?[t('a'),t('b')]:phase==='combat'?[t('c'),t('d')]:[t('e'),t('f')];return fighter==='scoped'?rows.map(row=>({...row,scope:phase==='lobby'?'homescreen':'gameplay'})):rows;} };
});
const deferred = () => { let resolve!:()=>void,reject!:(reason:unknown)=>void; const promise=new Promise<void>((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}; };
class Media extends EventTarget {
  static all:Media[]=[];
  src='';preload='none';volume=0;hidden=false;loop=false;paused=true;ended=false;currentTime=0;duration=120;error:unknown=null;removed=false;
  loads=0;plays=0;next?:ReturnType<typeof deferred>;
  constructor(){super();Media.all.push(this);}
  play(){this.plays++;this.paused=false;const d=this.next;this.next=undefined;return d?d.promise:Promise.resolve();}
  pause(){this.paused=true;}
  load(){this.loads++;this.currentTime=0;this.ended=false;this.error=null;}
  getAttribute(n:string){return n==='src'?this.src:null;}
  removeAttribute(n:string){if(n==='src')this.src='';}
  remove(){this.removed=true;}
}
class Doc extends EventTarget { hidden=false;createElement(){return new Media();} }
let doc:Doc;
let instances:CharacterMusic[];
function music(){const m=new CharacterMusic({setAttribute(){},append(){}} as unknown as HTMLElement);instances.push(m);return m;}
async function settle(){await Promise.resolve();await Promise.resolve();await Promise.resolve();}
beforeEach(()=>{vi.useFakeTimers();Media.all=[];instances=[];doc=new Doc();vi.stubGlobal('document',doc);});
afterEach(()=>{instances.forEach(m=>m.dispose());vi.useRealTimers();vi.unstubAllGlobals();});

describe('local soundtrack transport',()=>{
 it('does not request media before enable and calls play synchronously with the gesture',async()=>{
  const m=music();expect(Media.all).toHaveLength(2);expect(Media.all.every(a=>!a.src && !a.loads && !a.plays)).toBe(true);
  const ready=m.setEnabled(true);expect(Media.all[0].plays).toBe(1);await ready;
  expect(Media.all.map(a=>a.src)).toEqual(['/assets/music/a.m4a','/assets/music/b.m4a']);expect(Media.all[1].plays).toBe(0);expect(m.getStatus().state).toBe('playing');
 });
 it('fades only after incoming playback starts, retaining outgoing sound during buffering',async()=>{
  const m=music();await m.setEnabled(true);const [a,b]=Media.all;const wait=deferred();b.next=wait;
  m.setContext('goku',undefined,'combat');expect(a.paused).toBe(false);expect(a.volume).toBeCloseTo(.18);expect(b.volume).toBe(0);
  vi.advanceTimersByTime(2000);expect(a.volume).toBeCloseTo(.18);wait.resolve();await settle();
  vi.advanceTimersByTime(600);expect(a.volume).toBeCloseTo(.09);expect(b.volume).toBeCloseTo(.09);
  vi.advanceTimersByTime(600);expect(a.paused).toBe(true);expect(b.volume).toBeCloseTo(.18);expect(m.getStatus().track?.id).toBe('c');expect(a.src).toBe('/assets/music/d.m4a');
 });
 it('late playback resolution after off never restarts audio or publishes playing',async()=>{
  const m=music(),wait=deferred();Media.all[0].next=wait;const states:string[]=[];m.onStatus=s=>states.push(s.state);
  const playing=m.setEnabled(true);await m.setEnabled(false);wait.resolve();await playing;
  expect(Media.all.every(a=>a.paused)).toBe(true);expect(states).not.toContain('playing');expect(m.getStatus().state).toBe('off');expect(vi.getTimerCount()).toBe(0);
 });
 it('a stale promise cannot pause a deck reused by a newer user play request',async()=>{
  const m=music(),wait=deferred();Media.all[0].next=wait;const old=m.setEnabled(true);await m.setEnabled(false);await m.setEnabled(true);
  wait.resolve();await old;expect(Media.all[0].paused).toBe(false);expect(m.getStatus().state).toBe('playing');
 });
 it('disposal cancels pending play and releases every media source',async()=>{
  const m=music(),wait=deferred();Media.all[0].next=wait;const p=m.setEnabled(true);m.dispose();wait.resolve();await p;
  expect(Media.all.every(a=>a.paused&&a.removed&&!a.src)).toBe(true);expect(vi.getTimerCount()).toBe(0);
 });
 it('visibility pauses both decks mid-fade, and plays again when the tab comes back',async()=>{
  const m=music();await m.setEnabled(true);m.setContext('goku',undefined,'combat');await settle();vi.advanceTimersByTime(300);
  doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));vi.advanceTimersByTime(2000);expect(Media.all.every(a=>a.paused)).toBe(true);expect(vi.getTimerCount()).toBe(0);
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await settle();vi.advanceTimersByTime(1200);await settle();
  expect(m.getStatus().state).toBe('playing');expect(Media.all.filter(a=>!a.paused)).toHaveLength(1);
 });
 it('resume() brings back music a pause menu or a hidden tab stopped, never one the player paused',async()=>{
  const m=music();await m.setEnabled(true);await settle();
  m.pause(true);m.resume();await settle();expect(m.getStatus().state).toBe('paused');
  await m.setEnabled(true);await settle();m.pause();m.resume();await settle();expect(m.getStatus().state).toBe('playing');
 });
 it('preserves outgoing playback on a failed incoming track and permits a retry',async()=>{
  const m=music();await m.setEnabled(true);const bad=deferred();Media.all[1].next=bad;m.setContext('goku',undefined,'combat');bad.reject(new Error('Network error'));await settle();
  expect(Media.all[0].paused).toBe(false);expect(Media.all[0].volume).toBeCloseTo(.18);expect(m.getStatus().state).toBe('unavailable');
  await m.setEnabled(true);vi.advanceTimersByTime(1200);expect(m.getStatus().state).toBe('playing');expect(m.getStatus().track?.id).toBe('c');
 });
 it('autoplay rejection is retryable with a fresh Play gesture',async()=>{
  const m=music(),bad=deferred();Media.all[0].next=bad;const p=m.setEnabled(true);bad.reject(Object.assign(new Error('gesture'),{name:'NotAllowedError'}));await p;
  expect(m.getStatus().state).toBe('ready');expect(Media.all.every(a=>a.paused)).toBe(true);await m.setEnabled(true);expect(m.getStatus().state).toBe('playing');
 });
 it('coalesces rapid phase changes and Next without a third media element',async()=>{
  const m=music();await m.setEnabled(true);m.setContext('goku',undefined,'combat');await settle();vi.advanceTimersByTime(200);
  m.setContext('goku',undefined,'results');m.next();vi.advanceTimersByTime(1000);await settle();vi.advanceTimersByTime(1200);await settle();
  expect(Media.all).toHaveLength(2);expect(m.getStatus().track?.id).toBe('f');expect(Media.all.filter(a=>!a.paused)).toHaveLength(1);expect(Media.all.find(a=>!a.paused)?.src).toBe('/assets/music/f.m4a');
 });
 it('Next replaces a stalled incoming request without waiting for its old play promise',async()=>{
  const m=music();await m.setEnabled(true);const stalled=deferred();Media.all[1].next=stalled;
  m.setContext('goku',undefined,'combat');m.next();await settle();vi.advanceTimersByTime(1200);await settle();
  expect(m.getStatus().track?.id).toBe('d');expect(m.getStatus().state).toBe('playing');
  stalled.resolve();await settle();expect(Media.all.find(a=>a.src==='/assets/music/d.m4a')?.paused).toBe(false);
 });
 it('late ended events from old decks do not advance the current song',async()=>{
  const m=music();await m.setEnabled(true);m.next();await settle();vi.advanceTimersByTime(1200);await settle();
  const old=Media.all[0];old.dispatchEvent(new Event('ended'));await settle();expect(m.getStatus().track?.id).toBe('b');
 });
 it('preloads just one next track and resets a reused deck to the song start',async()=>{
  const m=music();await m.setEnabled(true);Media.all[0].currentTime=118.9;m.next();await settle();vi.advanceTimersByTime(1200);await settle();
  expect(Media.all[0].currentTime).toBe(0);expect(Media.all.map(a=>a.src).sort()).toEqual(['/assets/music/a.m4a','/assets/music/b.m4a']);
 });
 it('keeps background playback continuous through repeated voice and impact activity',async()=>{
  const m=music();m.setVolume(.5);await m.setEnabled(true);const a=Media.all[0];a.currentTime=40;const plays=a.plays,loads=a.loads;let previous=a.volume;
  for(let n=0;n<8;n++){
   m.duck(n%2===0);
   for(let frame=0;frame<8;frame++){vi.advanceTimersByTime(25);expect(a.paused).toBe(false);expect(a.currentTime).toBe(40);expect(a.volume).toBeGreaterThanOrEqual(.45);expect(Math.abs(a.volume-previous)).toBeLessThan(.015);previous=a.volume;}
  }
  m.duck(false);vi.advanceTimersByTime(1200);expect(a.volume).toBeCloseTo(.5);expect(a.plays).toBe(plays);expect(a.loads).toBe(loads);
 });
 it('applies voice ducking and volume changes to both fade envelopes',async()=>{
  const m=music();await m.setEnabled(true);m.setContext('goku',undefined,'combat');await settle();vi.advanceTimersByTime(600);
  m.setVolume(.5);m.duck(true);vi.advanceTimersByTime(350);const weights=Media.all.map(a=>a.volume);expect(weights[0]+weights[1]).toBeCloseTo(.45);expect(weights.every(v=>v>0&&v<.45)).toBe(true);
  m.duck(false);vi.advanceTimersByTime(1200);expect(Media.all.find(a=>!a.paused)?.volume).toBeCloseTo(.5);
 });
});


describe('exclusive home music boundary',()=>{
 it('clears home playback immediately while a battle song is still buffering',async()=>{
  const m=music();m.setContext('scoped',undefined,'lobby');await m.setEnabled(true);
  const blocked=deferred();Media.all[0].next=blocked;
  m.setContext('scoped',undefined,'combat');
  expect(Media.all.some(a=>a.src.endsWith('/a.m4a')||a.src.endsWith('/b.m4a'))).toBe(false);
  expect(Media.all.every(a=>a.volume===0)).toBe(true);
  blocked.resolve();await settle();expect(m.getStatus().track?.id).toBe('c');
 });
 it('never restores battle audio from a stale promise after returning home',async()=>{
  const m=music();m.setContext('scoped',undefined,'lobby');await m.setEnabled(true);
  const blocked=deferred();Media.all[0].next=blocked;m.setContext('scoped',undefined,'combat');
  m.setContext('scoped',undefined,'lobby');await settle();blocked.resolve();await settle();
  expect(m.getStatus().track?.id).toBe('a');expect(Media.all.filter(a=>!a.paused).map(a=>a.src)).toEqual(['/assets/music/a.m4a']);
 });
 it('preserves an explicit pause across the home/game boundary',async()=>{
  const m=music();m.setContext('scoped',undefined,'lobby');await m.setEnabled(true);m.pause();
  m.setContext('scoped',undefined,'combat');await settle();expect(Media.all.every(a=>a.paused)).toBe(true);
  await m.setEnabled(true);expect(m.getStatus().track?.id).toBe('c');
 });
});

describe('a big blow\'s beat in the score (the Rise of a Ninja pass, iteration two)',()=>{
 it('dips under the freeze and comes back under the blow\'s tail, then lets the timer go',async()=>{
  const m=music();await m.setEnabled(true);const [a]=Media.all;expect(a.volume).toBeCloseTo(.18);
  m.punch(.22);vi.advanceTimersByTime(50);expect(a.volume).toBeCloseTo(.09);
  vi.advanceTimersByTime(150);expect(a.volume).toBeCloseTo(.09);
  vi.advanceTimersByTime(300);expect(a.volume).toBeGreaterThan(.09);expect(a.volume).toBeLessThan(.18);
  vi.advanceTimersByTime(500);expect(a.volume).toBeCloseTo(.18);
  expect(vi.getTimerCount()).toBe(0);
 });
 it('stays silent when the score is off or paused',async()=>{
  const m=music();const [a]=Media.all;m.punch(.2);vi.advanceTimersByTime(100);expect(a.volume).toBe(0);
 });
});
