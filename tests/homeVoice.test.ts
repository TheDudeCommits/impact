import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {HomeVoice} from '../src/audio/HomeVoice';
import homeVoices from '../public/assets/audio/home/manifest.json';

class Media extends EventTarget {
 src='';dataset:Record<string,string>={};preload='';hidden=false;volume=1;paused=true;ended=false;currentTime=0;plays=0;reject?:Error;
 play(){this.plays++;if(this.reject){const error=this.reject;this.reject=undefined;return Promise.reject(error);}this.paused=false;this.dispatchEvent(new Event('playing'));return Promise.resolve();}
 pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
 getAttribute(){return this.src;}
 remove(){}
}
let doc:EventTarget&{hidden:boolean},win:EventTarget,media:Media,voice:HomeVoice;
beforeEach(()=>{
 vi.useFakeTimers();media=new Media();win=new EventTarget();doc=Object.assign(new EventTarget(),{hidden:false,createElement:()=>media});
 vi.stubGlobal('document',doc);vi.stubGlobal('window',win);voice=new HomeVoice({append(){}} as unknown as HTMLElement);voice.setMix(.5,.8);
});
afterEach(()=>{voice.dispose();vi.useRealTimers();vi.unstubAllGlobals();});
it('coalesces hover, focus and click, but a later click replays the line',()=>{
 voice.preview('goku');voice.preview('goku');voice.preview('goku',true);expect(media.plays).toBe(1);expect(media.volume).toBeCloseTo(.4);
 voice.preview('goku',true);expect(media.plays).toBe(1);vi.advanceTimersByTime(500);voice.preview('goku',true);expect(media.plays).toBe(2);
});
it('only plays the final hovered fighter and interrupts the previous line',()=>{
 voice.preview('goku',true);voice.preview('naruto');expect(media.paused).toBe(true);vi.advanceTimersByTime(50);voice.preview('luffy');vi.advanceTimersByTime(100);
 expect(media.plays).toBe(2);expect(media.src).toMatch('/luffy.m4a');
});
it('versions media-element playback so returning players hear the current recording',()=>{
 const record=homeVoices.assets.find(row=>row.fighter==='goku')!;
 voice.preview('goku',true);
 const url=new URL(media.src,'https://jump.dude.work');
 expect(url.pathname).toBe(record.file);
 expect(url.searchParams.get('v')).toBe(record.runtimeSha256.slice(0,12));
});
it('retries a blocked first hover synchronously in a real activation, using the latest fighter',async()=>{
 media.reject=Object.assign(new Error('gesture'),{name:'NotAllowedError'});voice.preview('goku');await vi.advanceTimersByTimeAsync(100);expect(media.paused).toBe(true);
 voice.preview('naruto');win.dispatchEvent(new Event('pointerdown'));expect(media.src).toMatch('/naruto.m4a');expect(media.paused).toBe(false);
});
it('mute, opening a dialog or starting a match cancels playback and queued hovers',()=>{
 const activity=vi.fn();voice.onActivity=activity;voice.preview('law',true);expect(activity).toHaveBeenLastCalledWith(true);
 voice.setMix(1,0);expect(media.paused).toBe(true);expect(activity).toHaveBeenLastCalledWith(false);
 voice.preview('gojo',true);expect(media.plays).toBe(1);voice.setMix(1,1);voice.preview('guts');voice.stop();vi.advanceTimersByTime(200);expect(media.plays).toBe(1);
 win.dispatchEvent(new Event('pointerdown'));expect(media.plays).toBe(1);
});
it('tab hiding stops voice without resuming it or leaving music ducked',()=>{
 const activity=vi.fn();voice.onActivity=activity;voice.preview('killua',true);doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));
 expect(media.paused).toBe(true);expect(activity).toHaveBeenLastCalledWith(false);doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));expect(media.plays).toBe(1);
});
