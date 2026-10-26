import * as THREE from 'three';
import {viewHeight,viewWidth} from './viewport';
import type { CombatEvent, FighterId, PlayerState } from '../game/types';
import { DREAM_IMPACT } from '../render/dreamFlag';

const FINISHER_WORDS: Partial<Record<FighterId, string>> = {
  goku: 'ドゴォッ', vegeta: 'ズガァン', naruto: 'ボボンッ', sasuke: 'チチチッ', kakashi: 'バリィッ', luffy: 'ギュルルッ',
  zoro: 'ズバァッ', sanji: 'ドガァッ', jotaro: 'オラァッ', ichigo: 'ザンッ', ace: 'ゴォォッ', law: 'スパッ',
  gojo: 'ギュオッ', dio: '無駄ァッ', guts: 'ドガァン', killua: 'バチィッ',
};

export function mangaImpactProfile(event: CombatEvent) {
  if(event.kind==='just-guard')return {strength:2,word:'キィン',duration:.42,size:150,guarded:true,tag:'PARRY'};
  if(event.kind==='guard-break')return {strength:2,word:'バリンッ',duration:.4,size:150,guarded:false,tag:'GUARD BREAK'};
  if(event.kind==='break')return {strength:1,word:'ドンッ',duration:.32,size:128,guarded:false};
  if(event.kind==='vanish')return {strength:2,word:'シュン',duration:.34,size:150,guarded:false};
  if(event.kind==='chase')return {strength:1,word:'ギュンッ',duration:.28,size:120,guarded:false};
  if (event.kind !== 'hit' && event.kind !== 'blocked') return null;
  const guarded=event.kind==='blocked';
  const finisher=!guarded&&event.slot==='light'&&(event.chain??0)>=3;
  const strength=guarded?0:event.slot==='ultimate'?3:event.slot==='special'||finisher?2:event.slot==='heavy'?1:0;
  return { strength, word:guarded?'ガッ':finisher?(event.fighter&&FINISHER_WORDS[event.fighter])||'ドゴォッ':strength===3?'ドォン':strength===2?'ズドン':strength===1?'バキッ':'バッ',
    duration:[.22,.28,.36,.45][strength],size:[76,112,160,210][strength],guarded,tag:undefined as string|undefined };
}

export const ACCENT_THROTTLE = .075;
export function accentSlot(strength: number, lastStrength: number, gap: number): 'free' | 'preempt' | 'held' {
  if (gap >= ACCENT_THROTTLE) return 'free';
  return strength > lastStrength ? 'preempt' : 'held';
}

export function farSide(victim:{x:number;y:number},attacker:{x:number;y:number}|undefined,reach:number,size:number,width:number,height:number,out={x:0,y:0,angle:0}){
  const dx=attacker?victim.x-attacker.x:0,dy=attacker?victim.y-attacker.y:0;
  const side=Math.abs(dx)<12?1:Math.sign(dx);
  const lift=Math.max(-.5,Math.min(.5,Math.abs(dx)<12?-.3:dy/Math.max(1,Math.abs(dx))));
  const reachOut=reach+size*.34;
  const margin=size*.55,top=Math.max(margin,height*.255+size*.5),bottom=Math.min(height-margin,height*.74-size*.3);
  out.x=Math.min(width-margin,Math.max(margin,victim.x+side*reachOut));
  out.y=Math.min(bottom,Math.max(top,victim.y-reach*.35+lift*size*.3));
  out.angle=-side*(9+Math.abs(lift)*10);
  return out;
}

export class MangaImpact {
  private seen=new Set<number>();
  private hits:{element:HTMLDivElement;word:HTMLElement;side:number;point:THREE.Vector3;from?:THREE.Vector3;victim?:string;attacker?:string;free:boolean;born:number;duration:number;size:number;seed:number}[]=[];
  private projection=new THREE.Vector3();
  private other=new THREE.Vector3();
  private body=new THREE.Vector3();
  private screenVictim={x:0,y:0};private screenAttacker={x:0,y:0};private place={x:0,y:0,angle:0};
  bodies?:(id:string,out:THREE.Vector3)=>boolean;
  private edge:HTMLDivElement;
  private edgeUntil=0;
  private lastAccent=-100;
  reduced=false;
  density=1;
  private lastStrength=0;
  constructor(private parent:HTMLElement){
    this.edge=document.createElement('div');this.edge.className='manga-speed-frame';this.edge.setAttribute('aria-hidden','true');parent.append(this.edge);
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  handle(events:CombatEvent[],selfId:string,players:PlayerState[]){
    for(const event of events){
      if(this.seen.has(event.id))continue;this.seen.add(event.id);
      const local=event.actorId===selfId||event.targetId===selfId;
      if(event.kind==='eliminated'){if(local&&this.density>=.05)this.knockout(event.actorId===selfId);continue;}
      if(event.kind==='whiff'){if(local&&this.density>=.05)this.whiff(event);continue;}
      const profile=mangaImpactProfile(event);if(!profile||!local||this.density<.05)continue;
      if(DREAM_IMPACT&&event.kind==='hit'&&profile.strength<2)continue;
      if(DREAM_IMPACT&&(event.kind==='vanish'||event.kind==='chase'||event.kind==='break'))continue;
      const at=event.endpoint??players.find(p=>p.id===event.targetId);if(!at)continue;
      const free=event.kind==='vanish'||event.kind==='chase'||event.kind==='break';
      const actor=players.find(p=>p.id===event.actorId),origin=event.origin??(actor?{x:actor.x,y:actor.y+1.05,z:actor.z}:undefined);
      const now=performance.now()/1000;
      const slot=accentSlot(profile.strength,this.lastStrength,now-this.lastAccent);
      if(slot==='held')continue;
      if(slot==='preempt'){const stale=this.hits.pop();if(stale)stale.element.remove();}
      this.lastAccent=now;this.lastStrength=profile.strength;
      if(this.hits.length>=5)this.hits.shift()!.element.remove();
      const element=document.createElement('div');element.className=`manga-hit strength-${profile.strength}${profile.guarded?' guarded':''}`;
      element.setAttribute('aria-hidden','true');
      const ring=document.createElement('i');ring.className='ink-burst';
      const word=document.createElement('b');word.textContent=profile.word;element.append(ring,word);
      if(profile.tag)element.append(this.tagOf(profile.tag,profile.guarded?'#1d6fd8':'#d8263a'));
      element.style.setProperty('--impact-accent',event.fighter==='naruto'&&event.slot==='ultimate'?'#a89bf8':profile.strength>1?'#7ce8fa':'#fff9e8');
      this.parent.append(element);
      this.hits.push({element,word,side:1,point:new THREE.Vector3(at.x,at.y,at.z),from:origin?new THREE.Vector3(origin.x,origin.y,origin.z):undefined,victim:event.targetId,attacker:event.actorId,free,born:now,duration:profile.duration,size:profile.size,seed:event.id});
      if(profile.strength>=2&&!this.reduced){this.edgeUntil=now+.14;this.edge.style.opacity=String(profile.strength===3?.55:.32);}
    }
    if(this.seen.size>512)this.seen=new Set([...this.seen].slice(-256));
  }
  private whiff(event:CombatEvent){
    const now=performance.now()/1000;
    this.lastAccent=now;this.lastStrength=1;
    if(this.hits.length>=5)this.hits.shift()!.element.remove();
    const element=document.createElement('div');element.className='manga-hit strength-1 whiff';element.setAttribute('aria-hidden','true');
    const ring=document.createElement('i');ring.className='ink-burst';
    const word=document.createElement('b');word.textContent='スカッ';
    element.append(ring,word,this.tagOf('MISS','#111318'));element.style.setProperty('--impact-accent','#fff9e8');
    this.parent.append(element);
    const o=event.origin;
    this.hits.push({element,word,side:1,point:new THREE.Vector3(o?.x??0,(o?.y??0)+1.05,o?.z??0),victim:event.actorId,free:false,born:now,duration:.7,size:124,seed:event.id});
  }
  private tagOf(text:string,fill:string){
    const tag=document.createElement('span');tag.textContent=text;
    Object.assign(tag.style,{position:'absolute',left:'50%',top:'78%',transform:'translateX(-50%) skewX(-12deg)',padding:'2px 12px',background:fill,color:'#fff8e8',
      fontFamily:"'Arial Black',Impact,sans-serif",fontSize:'22px',fontWeight:'900',fontStyle:'italic',letterSpacing:'3px',border:'2px solid #fff8e8',whiteSpace:'nowrap'});
    return tag;
  }
  private knockout(dealt:boolean){
    if(!this.ko){
      const ko=document.createElement('div');ko.setAttribute('aria-hidden','true');
      Object.assign(ko.style,{position:'fixed',left:'50%',top:'42%',zIndex:'9',pointerEvents:'none',display:'none',textAlign:'center',
        transformOrigin:'50% 50%',willChange:'transform,opacity',isolation:'isolate'});
      const burst=document.createElement('i');
      Object.assign(burst.style,{position:'absolute',left:'50%',top:'50%',width:'640px',height:'640px',transform:'translate(-50%,-50%)',
        background:'repeating-conic-gradient(from 3deg,#111318 0deg 3deg,#fff8e8 3deg 4.5deg,transparent 4.5deg 16deg)',
        maskImage:'radial-gradient(circle,transparent 0 18%,#000 20% 34%,transparent 66%)',WebkitMaskImage:'radial-gradient(circle,transparent 0 18%,#000 20% 34%,transparent 66%)',opacity:'.9',zIndex:'-1'});
      const word=document.createElement('b');word.textContent='K.O.';
      Object.assign(word.style,{display:'block',fontFamily:"'Arial Black',Impact,'Hiragino Kaku Gothic ProN',sans-serif",fontSize:'150px',fontWeight:'1000',fontStyle:'italic',
        lineHeight:'1',letterSpacing:'-4px',color:'#111318',WebkitTextStroke:'3px #fff8e8',paintOrder:'stroke fill',
        textShadow:'5px 5px #fff8e8,-5px -5px #fff8e8,5px -5px #fff8e8,-5px 5px #fff8e8,12px 14px #d8263a,14px 16px #111318'});
      const kanji=document.createElement('span');kanji.textContent='撃破';
      Object.assign(kanji.style,{display:'inline-block',marginTop:'6px',padding:'4px 22px',background:'#d8263a',color:'#fff8e8',
        fontFamily:"'Hiragino Kaku Gothic ProN','Arial Black',sans-serif",fontSize:'44px',fontWeight:'900',letterSpacing:'8px',
        border:'3px solid #111318',boxShadow:'6px 6px 0 #111318',transform:'skewX(-12deg)'});
      ko.append(burst,word,kanji);this.parent.append(ko);this.ko=ko;
    }
    this.ko.style.display='block';this.koBorn=performance.now()/1000;
    (this.ko.children[2] as HTMLElement).style.background=dealt?'#d8263a':'#2a4fd0';
    if(!this.reduced){this.edgeUntil=this.koBorn+.4;this.edge.style.opacity='.75';}
  }
  private ko?:HTMLDivElement;
  private koBorn=-100;

  update(camera:THREE.Camera){
    const now=performance.now()/1000;
    if(now>=this.edgeUntil)this.edge.style.opacity='0';
    if(this.ko&&this.ko.style.display!=='none'){
      const t=(now-this.koBorn)/1.25;
      if(t>=1)this.ko.style.display='none';
      else{
        const punch=this.reduced?1:t<.08?2.2-1.2*(t/.08):1+.04*Math.sin(t*40)*Math.max(0,1-t*4);
        this.ko.style.transform=`translate(-50%,-50%) rotate(-7deg) scale(${punch.toFixed(3)})`;
        this.ko.style.opacity=String(Math.min(1,(1-t)*5));
      }
    }
    this.hits=this.hits.filter(hit=>{
      const t=(now-hit.born)/hit.duration;if(t>=1){hit.element.remove();return false;}
      const victim=!hit.free&&hit.victim&&this.bodies?.(hit.victim,this.body)?this.body.setY(this.body.y+.15):hit.point;
      this.projection.copy(victim).project(camera);
      const visible=this.projection.z>-1&&this.projection.z<1&&Math.abs(this.projection.x)<1.15&&Math.abs(this.projection.y)<1.15;
      hit.element.style.display=visible?'block':'none';
      const vx=(this.projection.x*.5+.5)*viewWidth(),vy=(-this.projection.y*.5+.5)*viewHeight();
      let x=vx,y=vy,angle=hit.seed%2?-11:7;
      if(!hit.free){
        this.other.copy(victim).setY(victim.y+.5).project(camera);
        const reach=Math.min(viewHeight()*.25,Math.abs((-this.other.y*.5+.5)*viewHeight()-vy)*.75);
        let attacker:{x:number;y:number}|undefined;
        const from=hit.attacker&&this.bodies?.(hit.attacker,this.other)?this.other.setY(this.other.y+.15):hit.from;
        if(from){this.other.copy(from).project(camera);if(this.other.z<1){attacker=this.screenAttacker;attacker.x=(this.other.x*.5+.5)*viewWidth();attacker.y=(-this.other.y*.5+.5)*viewHeight();}}
        this.screenVictim.x=vx;this.screenVictim.y=vy;
        const place=farSide(this.screenVictim,attacker,reach,hit.size,viewWidth(),viewHeight(),this.place);x=place.x;y=place.y;angle=place.angle+(hit.seed%3-1)*2;
        const side=x<vx?-1:1;
        if(side!==hit.side){hit.side=side;hit.word.style.left=side<0?'auto':'';hit.word.style.right=side<0?'25%':'';}
      }
      hit.element.style.left=`${x}px`;hit.element.style.top=`${y}px`;
      hit.element.style.width=hit.element.style.height=`${hit.size}px`;
      const scale=this.reduced?1:.8+Math.min(1,t*6)*.3;
      hit.element.style.transform=`translate(-50%,-50%) rotate(${angle.toFixed(1)}deg) scale(${scale})`;
      hit.element.style.opacity=String(Math.min(1,(1-t)*3));
      return true;
    });
  }
  reset(){this.hits.forEach(hit=>hit.element.remove());this.hits=[];this.seen.clear();this.edge.style.opacity='0';this.edgeUntil=0;this.lastAccent=-100;if(this.ko)this.ko.style.display='none';}
  dispose(){this.reset();this.edge.remove();this.ko?.remove();}
}
