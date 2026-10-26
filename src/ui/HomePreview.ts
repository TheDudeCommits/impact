import { FIGHTERS } from '../config';
import type { FighterId } from '../game/types';
import spriteManifest from '../../public/assets/home/sprites/manifest.json';
import { packArt, packHas } from '../engine/packs/active';
import { PoseSheetLoader } from './PoseSheetLoader';

export const SPRITE_COLUMNS = 4;
export const SPRITE_FRAMES = 16;
const POSE_VERSIONS = new Map(spriteManifest.fighters.map(fighter=>[fighter.id,{
  sheet:'sha256' in fighter?fighter.sha256?.slice(0,12)??'':'',
  poster:'posterSha256' in fighter?fighter.posterSha256?.slice(0,12)??'':'',
}]));
const versionSuffix=(hash:string|undefined)=>hash?`?v=${hash}`:'';
export const spriteArt = (id:FighterId) => `/assets/home/sprites/${id}.webp${versionSuffix(POSE_VERSIONS.get(id)?.sheet)}`;
export const posePoster = (id:FighterId) => packArt(id,'poster') ?? `/assets/home/sprites/${id}-poster.webp${versionSuffix(POSE_VERSIONS.get(id)?.poster)}`;
export const POSTER_ONLY:ReadonlySet<FighterId>=new Set(['kaido','whitebeard','shanks','roger','aizen']);
const POSE_SHEETS:ReadonlySet<string>=new Set(spriteManifest.fighters.map(fighter=>fighter.id));
export const hasPoseSheet=(id:FighterId)=>POSE_SHEETS.has(id)&&!packHas(id);
export type PoseTiming={frameTimesMs:number[];loopMs:number;loopStartFrame?:number};
export type PoseLayout={columns:number;frameCount:number;rows:number;heroFrame:number};
export function poseLayout(entry: {columns?:number;frameCount?:number;heroFrame?:number} = {}):PoseLayout {
  const frameCount=entry.frameCount===32?32:SPRITE_FRAMES;
  const requestedColumns=entry.columns??SPRITE_COLUMNS;
  const columns=Number.isInteger(requestedColumns)&&requestedColumns>0&&frameCount%requestedColumns===0?requestedColumns:SPRITE_COLUMNS;
  const heroFrame=Number.isInteger(entry.heroFrame)&&entry.heroFrame!>=0&&entry.heroFrame!<frameCount?entry.heroFrame!:7;
  return {columns,frameCount,rows:frameCount/columns,heroFrame};
}
export function poseCell(layout:PoseLayout,width:number,height:number,frame:number){
  const index=Math.min(layout.frameCount-1,Math.max(0,Number.isFinite(frame)?Math.floor(frame):layout.heroFrame));
  const cellWidth=width/layout.columns,cellHeight=height/layout.rows;
  return {index,x:(index%layout.columns)*cellWidth,y:Math.floor(index/layout.columns)*cellHeight,width:cellWidth,height:cellHeight};
}
const POSE_LAYOUTS=new Map<string,PoseLayout>(spriteManifest.fighters.map(fighter=>[fighter.id,poseLayout(fighter as Parameters<typeof poseLayout>[0]) ]));
export const poseLayoutFor=(id:string)=>POSE_LAYOUTS.get(id)??poseLayout();
export const poseTiming=(entry:{motionTiming?:PoseTiming;timing?:PoseTiming})=>entry.motionTiming??entry.timing;
const POSE_TIMINGS=new Map<string,PoseTiming>(spriteManifest.fighters.flatMap(fighter=>{
  const timing=poseTiming(fighter as Parameters<typeof poseTiming>[0]);return timing?[[fighter.id,timing]]:[];
}));
export function poseFrameAt(timing:PoseTiming|undefined,elapsed:number,layout:PoseLayout=poseLayout()):number {
  if(!timing)return layout.frameCount===16?poseFrame(elapsed):layout.heroFrame;
  const times=timing.frameTimesMs;
  if(times.length!==layout.frameCount||times[0]!==0||!Number.isFinite(timing.loopMs)||timing.loopMs<=times[times.length-1]
    ||times.some((time,index)=>!Number.isFinite(time)||(index>0&&time<=times[index-1])))return layout.heroFrame;
  const loopStart=Number.isInteger(timing.loopStartFrame)&&timing.loopStartFrame!>=0&&timing.loopStartFrame!<layout.frameCount?timing.loopStartFrame!:0;
  let time=Math.max(0,Number.isFinite(elapsed)?elapsed:0);
  if(time>=timing.loopMs){const begin=times[loopStart];time=begin+(time-timing.loopMs)%(timing.loopMs-begin);}
  for(let frame=times.length-1;frame>0;frame--)if(time>=times[frame])return frame;
  return 0;
}
export function timedPoseFrame(id:string,elapsed:number):number {
  return poseFrameAt(POSE_TIMINGS.get(id),elapsed,poseLayoutFor(id));
}

export function poseFrame(elapsed:number):number {
  const time=Math.max(0,elapsed)%3600;
  if(time<500)return 0;
  if(time<1300)return Math.min(7,1+Math.floor((time-500)/115));
  if(time<2300)return 7;
  return Math.min(15,8+Math.floor((time-2300)/145));
}

export type PosePage={file:string;sha256?:string;firstFrame:number;frameCount:number;width:number;height:number};
export function posePages(entry:{file:string;runtimePages?:PosePage[];cellWidth?:number;cellHeight?:number}&Partial<PoseLayout>):PosePage[]{
  const layout=poseLayout(entry),pages=entry.runtimePages;
  if(pages?.length&&pages.reduce((next,page)=>page.firstFrame===next&&page.frameCount>0&&page.frameCount%layout.columns===0&&page.width>0&&page.height>0?next+page.frameCount:-Infinity,0)===layout.frameCount)return pages;
  return [{file:entry.file,firstFrame:0,frameCount:layout.frameCount,width:layout.columns*(entry.cellWidth??384),height:layout.rows*(entry.cellHeight??512)}];
}
const POSE_PAGES=new Map(spriteManifest.fighters.map(entry=>[entry.id,posePages(entry as Parameters<typeof posePages>[0])]));
const pageArt=(page:PosePage,id:FighterId)=>page.sha256?`/assets/home/sprites/${page.file}${versionSuffix(page.sha256.slice(0,12))}`:spriteArt(id);

export class HomePreview {
  private canvas:HTMLCanvasElement;
  private context:CanvasRenderingContext2D;
  private active:FighterId='naruto';
  private ticket=0;
  private ready=false;
  private initialLoad?:Promise<void>;
  private pageLoad?:{url:string;promise:Promise<void>};
  private failedPages=new Set<string>();
  private pageFailures=new Map<string,number>();
  private retry?:{timer:ReturnType<typeof setTimeout>;url:string};
  private disposed=false;
  private request=0;
  private started=0;
  private suspendedAt:number|undefined;
  private voiceAudio?:HTMLAudioElement;
  private voiceOffset=0;
  private voiceMayHold=false;
  private voiceHolding=false;
  private elapsed=0;
  private buffering=false;
  private lastFrame=-1;
  private shown=true;
  private paused=false;
  private enabled=true;
  private reduced=matchMedia('(prefers-reduced-motion: reduce)');
  private observer:ResizeObserver;
  private renderWidth=0;
  private renderHeight=0;
  private dpr=1;

  constructor(private figure:HTMLElement,private loader=new PoseSheetLoader()) {
    this.canvas=document.createElement('canvas');
    this.canvas.className='home-pose-canvas';this.canvas.hidden=true;this.canvas.setAttribute('aria-hidden','true');
    figure.append(this.canvas);this.context=this.canvas.getContext('2d')!;
    this.observer=new ResizeObserver(()=>{this.layoutPoster();this.lastFrame=-1;this.draw(this.frame());});
    this.observer.observe(this.figure);
    this.reduced.addEventListener('change',this.refresh);
    document.addEventListener('visibilitychange',this.refresh);
    window.addEventListener('home-voice-playing',this.voicePlaying);
    this.active=(figure.querySelector<HTMLElement>('[data-preview]:not([hidden])')?.dataset.preview as FighterId)??this.active;
    void this.select(this.active);
  }
  async select(id:FighterId) {
    if(this.disposed)return;
    if(id===this.active&&(this.ready||this.initialLoad)){
      if(this.failedPages.size){this.resetFailures();this.refresh();}
      return this.initialLoad;
    }
    ++this.ticket;this.loader.cancel();this.active=id;this.ready=false;this.initialLoad=undefined;this.pageLoad=undefined;
    this.resetFailures();this.voiceAudio=undefined;this.voiceOffset=0;this.voiceMayHold=false;this.voiceHolding=false;this.started=0;this.elapsed=0;this.buffering=false;this.stop();
    this.figure.dataset.previewFighter=id;this.canvas.hidden=true;this.figure.classList.remove('pose-ready');
    this.figure.querySelectorAll<HTMLImageElement>('[data-preview]').forEach(img=>{
      img.hidden=img.dataset.preview!==id;
      if(!img.hidden){
        img.decoding='async';img.fetchPriority='high';
        if(img.dataset.previewSrc){img.src=img.dataset.previewSrc;delete img.dataset.previewSrc;}
      }
      else if(img.hasAttribute('src')){img.dataset.previewSrc=img.getAttribute('src')!;img.removeAttribute('src');}
    });this.layoutPoster();
    return this.loadSelected();
  }
  private canAnimate(){return this.shown&&!document.hidden&&!this.paused&&this.enabled&&!this.reduced.matches;}
  private pages(){return POSE_PAGES.get(this.active)??[];}
  private loadSelected():Promise<void>|undefined {
    if(this.ready||this.initialLoad||!this.canAnimate()||!hasPoseSheet(this.active))return this.initialLoad;
    const page=this.pages()[0];if(!page)return;
    const ticket=this.ticket,url=pageArt(page,this.active);
    if(this.failedPages.has(url))return;
    const pending=this.loader.load(url,page.width*page.height*4).then(image=>{
      if(!image||ticket!==this.ticket||this.disposed||!this.canAnimate())return;
      this.failedPages.delete(url);this.pageFailures.delete(url);
      this.ready=true;this.started=performance.now();this.suspendedAt=undefined;this.elapsed=0;this.buffering=false;this.voiceHolding=false;
      this.voiceOffset=-(this.voiceAudio?.currentTime??0)*1000;this.lastFrame=-1;
      this.canvas.hidden=false;this.figure.classList.add('pose-ready');this.refresh();
    }).catch(()=>{if(ticket===this.ticket){this.recordFailure(url);this.scheduleRetry(page,true);}})
      .finally(()=>{if(this.initialLoad===pending)this.initialLoad=undefined;});
    this.initialLoad=pending;return pending;
  }
  private requestPage(page:PosePage,required=false){
    const ticket=this.ticket,url=pageArt(page,this.active);
    if(this.failedPages.has(url)){if(this.buffering)this.scheduleRetry(page);return;}
    if(this.loader.get(url)||this.pageLoad?.url===url)return;
    if(this.pageLoad&&!required)return;
    const promise=this.loader.load(url,page.width*page.height*4).then(image=>{
      if(image&&ticket===this.ticket&&!this.disposed&&this.canAnimate()){
        this.failedPages.delete(url);this.pageFailures.delete(url);
        if(this.buffering)this.refresh();else this.draw(this.frame());
      }
    }).catch(()=>{if(ticket===this.ticket){this.recordFailure(url);if(this.buffering)this.scheduleRetry(page);}})
      .finally(()=>{
        if(this.pageLoad?.promise===promise)this.pageLoad=undefined;
        if(ticket===this.ticket)this.warmSelectedPages();
      });
    this.pageLoad={url,promise};
  }
  private warmSelectedPages(){
    if(!this.ready||!this.canAnimate()||this.buffering||this.pageLoad||this.disposed)return;
    const page=this.pages().find(each=>{
      const url=pageArt(each,this.active);return !this.failedPages.has(url)&&!this.loader.get(url);
    });
    if(page)this.requestPage(page);
  }
  private recordFailure(url:string){this.failedPages.add(url);this.pageFailures.set(url,(this.pageFailures.get(url)??0)+1);}
  private cancelRetry(){if(this.retry)clearTimeout(this.retry.timer);this.retry=undefined;}
  private resetFailures(){this.cancelRetry();this.failedPages.clear();this.pageFailures.clear();}
  private scheduleRetry(page:PosePage,first=false){
    const url=pageArt(page,this.active),failures=this.pageFailures.get(url)??0;
    if(this.retry||failures>=3||!this.canAnimate())return;
    const ticket=this.ticket;
    this.retry={url,timer:setTimeout(()=>{
      this.retry=undefined;
      if(ticket!==this.ticket||this.disposed||!this.canAnimate())return;
      this.failedPages.delete(url);
      if(first)void this.loadSelected();else this.requestPage(page,true);
    },failures<=1?350:1000)};
  }
  private layoutPoster(){
    const rect=this.figure.getBoundingClientRect(),stature=Math.min(1,(FIGHTERS[this.active].height??1.8)/2.04);
    this.dpr=Math.min(devicePixelRatio||1,2);this.renderWidth=Math.round(rect.width*this.dpr);this.renderHeight=Math.round(rect.height*this.dpr);
    const height=Math.min(rect.height,rect.width*4/3)*stature,width=height*3/4;
    const poster=this.figure.querySelector<HTMLImageElement>(`[data-preview="${this.active}"]`);
    if(poster)Object.assign(poster.style,{inset:'auto',left:`${(rect.width-width)/2}px`,bottom:'0px',width:`${width}px`,height:`${height}px`});
  }
  setVisible(value:boolean){this.shown=value;if(value)this.layoutPoster();this.refresh();}
  setPaused(value:boolean){this.paused=value;this.refresh();}
  setEnabled(value:boolean){this.enabled=value;this.refresh();}
  private voicePlaying=(event:Event)=>{
    const {fighter,audio}=(event as CustomEvent<{fighter:FighterId;audio:HTMLAudioElement}>).detail;
    if(fighter!==this.active||!POSE_TIMINGS.has(fighter))return;
    const elapsed=this.ready?(this.buffering||this.voiceHolding?this.elapsed:(this.suspendedAt??performance.now())-this.started):0;
    this.voiceMayHold=this.voiceHolding||elapsed<POSE_TIMINGS.get(fighter)!.loopMs;
    this.voiceAudio=audio;this.voiceOffset=elapsed-audio.currentTime*1000;
    this.refresh();
  };
  private frame(){
    if(!this.enabled||this.reduced.matches)return poseLayoutFor(this.active).heroFrame;
    const layout=poseLayoutFor(this.active),timing=POSE_TIMINGS.get(this.active);
    if(this.buffering)return this.voiceHolding?layout.frameCount-1:timedPoseFrame(this.active,this.elapsed);
    const now=this.suspendedAt??performance.now();
    const speaking=!!this.voiceAudio&&!this.voiceAudio.paused&&!this.voiceAudio.ended;
    if(this.voiceHolding){
      if(speaking)return layout.frameCount-1;
      this.voiceHolding=false;this.voiceMayHold=false;this.started=now-this.elapsed;
      this.voiceOffset=this.elapsed-(this.voiceAudio?.currentTime??0)*1000;
    }
    let elapsed=Math.max(0,now-this.started);
    if(this.ready&&this.voiceAudio&&speaking&&!this.paused&&this.suspendedAt===undefined){
      elapsed=Math.max(elapsed,this.voiceAudio.currentTime*1000+this.voiceOffset);
      this.started=now-elapsed;
    }
    if(timing&&this.voiceMayHold&&speaking&&elapsed>=timing.loopMs){
      this.voiceHolding=true;this.elapsed=timing.loopMs;this.started=now-this.elapsed;
      return layout.frameCount-1;
    }
    this.elapsed=elapsed;return timedPoseFrame(this.active,elapsed);
  }
  private stop(){cancelAnimationFrame(this.request);this.request=0;}
  private refresh=()=>{
    if(this.disposed)return;
    this.stop();this.lastFrame=-1;
    const running=this.canAnimate();
    if(running&&this.suspendedAt!==undefined){
      this.resetFailures();
      this.started+=performance.now()-this.suspendedAt;this.suspendedAt=undefined;
      if(this.voiceAudio)this.voiceOffset=performance.now()-this.started-this.voiceAudio.currentTime*1000;
    }else if(!running)this.suspendedAt??=performance.now();
    if(!running){
      this.loader.cancel();this.cancelRetry();this.initialLoad=undefined;this.pageLoad=undefined;
      if(!this.shown||!this.enabled||this.reduced.matches){
        this.loader.releaseDecoded();this.ready=false;this.canvas.hidden=true;this.canvas.width=0;this.canvas.height=0;this.figure.classList.remove('pose-ready');
      }
      return;
    }
    if(!this.ready){void this.loadSelected();return;}
    this.draw(this.frame());if(!this.buffering)this.request=requestAnimationFrame(this.tick);
  };
  private tick=()=>{
    this.request=0;
    if(!this.canAnimate()||this.disposed){this.refresh();return;}
    this.draw(this.frame());if(!this.buffering)this.request=requestAnimationFrame(this.tick);
  };
  private draw(frame:number){
    if(!this.ready||!this.shown||document.hidden)return;
    if(this.dpr!==Math.min(devicePixelRatio||1,2)){this.layoutPoster();this.lastFrame=-1;}
    if(frame===this.lastFrame)return;
    const pages=this.pages(),pageIndex=pages.findIndex(page=>frame>=page.firstFrame&&frame<page.firstFrame+page.frameCount),page=pages[pageIndex];
    if(!page)return;
    const sheet=this.loader.get(pageArt(page,this.active));
    if(!sheet){this.buffering=true;if(this.canAnimate())this.requestPage(page,true);return;}
    if(this.buffering){
      this.buffering=false;this.started=performance.now()-this.elapsed;
      if(this.voiceAudio)this.voiceOffset=this.elapsed-this.voiceAudio.currentTime*1000;
    }
    const width=this.renderWidth,height=this.renderHeight;if(!width||!height)return;
    if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}
    this.context.clearRect(0,0,width,height);
    const columns=poseLayoutFor(this.active).columns,local=frame-page.firstFrame;
    const cellWidth=sheet.width/columns,cellHeight=sheet.height/(page.frameCount/columns);
    const stature=(FIGHTERS[this.active].height??1.8)/2.04;
    const drawHeight=Math.min(height,width*cellHeight/cellWidth)*Math.min(1,stature),drawWidth=drawHeight*cellWidth/cellHeight;
    this.context.drawImage(sheet.source,(local%columns)*cellWidth,Math.floor(local/columns)*cellHeight,cellWidth,cellHeight,(width-drawWidth)/2,height-drawHeight,drawWidth,drawHeight);
    this.canvas.dataset.frame=String(frame);this.canvas.dataset.previewFighter=this.active;this.lastFrame=frame;
    this.warmSelectedPages();
  }
  dispose(){this.disposed=true;this.ticket++;this.ready=false;this.stop();this.cancelRetry();this.loader.dispose();this.canvas.width=0;this.canvas.height=0;this.observer.disconnect();this.reduced.removeEventListener('change',this.refresh);document.removeEventListener('visibilitychange',this.refresh);window.removeEventListener('home-voice-playing',this.voicePlaying);}
}
