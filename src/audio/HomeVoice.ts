import type { FighterId } from '../game/types';
import voiceManifest from '../../public/assets/audio/home/manifest.json';

export const HOME_VOICES:Partial<Record<FighterId,string>> = Object.fromEntries(
  voiceManifest.assets.map(asset=>[asset.fighter,asset.file]),
);
const PLAYBACK_SOURCES = new Map(voiceManifest.assets.map(asset=>{
  const hash = 'runtimeSha256' in asset && typeof asset.runtimeSha256 === 'string'
    ? asset.runtimeSha256.slice(0,12) : '';
  return [asset.fighter, hash ? `${asset.file}?v=${hash}` : asset.file];
}));
export const HOME_VOICE_SECONDS:Partial<Record<FighterId,number>> = Object.fromEntries(
  voiceManifest.assets.flatMap(asset=>{const seconds=(asset as {durationSeconds?:number}).durationSeconds;return typeof seconds==='number'&&seconds>0?[[asset.fighter,seconds]]:[];}),
);

export class HomeVoice {
  onActivity=(active:boolean)=>{};
  private audio:HTMLAudioElement;
  private wanted?:FighterId;
  private current?:FighterId;
  private timer?:ReturnType<typeof setTimeout>;
  private ticket=0;
  private began=0;
  private blocked=false;
  private audible=false;
  constructor(parent:HTMLElement) {
    this.audio=document.createElement('audio');this.audio.hidden=true;this.audio.preload='none';
    this.audio.dataset.homeVoice='';parent.append(this.audio);
    this.audio.addEventListener('playing',()=>{
      if(!this.current||this.audio.paused)return;
      this.activity(true);
      window.dispatchEvent(new CustomEvent('home-voice-playing',{detail:{fighter:this.current,audio:this.audio}}));
    });
    this.audio.addEventListener('ended',()=>{this.current=undefined;this.activity(false);});
    this.audio.addEventListener('pause',()=>this.activity(false));
    this.audio.addEventListener('error',()=>this.activity(false));
    window.addEventListener('pointerdown',this.activate);
    window.addEventListener('keydown',this.activate);
    document.addEventListener('visibilitychange',this.visibility);
  }
  setMix(master:number,voice:number){
    this.audio.volume=Math.max(0,Math.min(1,master*voice));
    if(!this.audio.volume)this.stop();
  }
  preview(fighter:FighterId,immediate=false){
    if(document.hidden||!this.audio.volume)return;
    if(this.wanted===fighter&&this.timer){if(immediate)this.play(fighter);return;}
    if(this.current===fighter&&!this.audio.paused&&!this.audio.ended&&(!immediate||performance.now()-this.began<350))return;
    this.stop();this.wanted=fighter;
    if(immediate)this.play(fighter);
    else this.timer=setTimeout(()=>this.play(fighter),100);
  }
  private activate=()=>{if(this.wanted&&(this.blocked||this.timer))this.play(this.wanted);};
  private visibility=()=>{if(document.hidden)this.stop();};
  private play(fighter:FighterId){
    clearTimeout(this.timer);this.timer=undefined;
    const source=PLAYBACK_SOURCES.get(fighter);
    if(!source){this.stop();return;}
    const ticket=++this.ticket;this.blocked=false;this.audio.pause();
    this.wanted=fighter;this.current=fighter;this.began=performance.now();
    if(this.audio.getAttribute('src')!==source)this.audio.src=source;
    this.audio.currentTime=0;this.audio.dataset.fighterVoice=fighter;
    void this.audio.play().catch(error=>{
      if(ticket!==this.ticket)return;
      this.activity(false);this.current=undefined;
      this.blocked=error?.name==='NotAllowedError';
      if(!this.blocked)this.wanted=undefined;
    });
  }
  stop(){
    clearTimeout(this.timer);this.timer=undefined;++this.ticket;
    this.wanted=undefined;this.current=undefined;this.blocked=false;
    this.audio.pause();this.activity(false);
  }
  private activity(value:boolean){if(this.audible===value)return;this.audible=value;this.onActivity(value);}
  dispose(){this.stop();window.removeEventListener('pointerdown',this.activate);window.removeEventListener('keydown',this.activate);document.removeEventListener('visibilitychange',this.visibility);this.audio.remove();}
}
