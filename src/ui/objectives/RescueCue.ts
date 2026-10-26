import * as THREE from 'three';
import type {GameSnapshot,PlayerState} from '../../game/types';
import {FIGHTERS} from '../../config';
import {objectiveOf,RULES} from '../../game/objectives/model';
import {pictures} from '../hud/protos/proto';

const C=48,R=44,RI=36;
const corner=(r:number,i:number):[number,number]=>{const t=(-90+60*i)*Math.PI/180;return [C+r*Math.cos(t),C+2+r*Math.sin(t)];};
const hex=(r:number)=>`M${[0,1,2,3,4,5].map(i=>corner(r,i).map(v=>v.toFixed(1)).join(' ')).join('L')}Z`;
const ENDS=[0,1,2,3,4,5].map(i=>{const [x0,y0]=corner(R,i),[x1,y1]=corner(R,i+1),g=.13;return [x0+(x1-x0)*g,y0+(y1-y0)*g,x1-(x1-x0)*g,y1-(y1-y0)*g] as const;});
let cues=0;

export class RescueCue {
  private root=document.createElement('div');
  private title:HTMLElement;private detail:HTMLElement;private arrow:HTMLElement;
  private face:SVGImageElement;private blades:SVGLineElement[];private fighter='';private shown=-1;
  private point=new THREE.Vector3();private view=new THREE.Vector3();
  private nextLayout=0;private obstacles:DOMRect[]=[];private target='';
  constructor(private parent:HTMLElement){
    const id=`rcue${cues++}`;
    this.root.className='objective-rescue-cue hidden';
    this.root.innerHTML='<i class="rescue-bearing" aria-hidden="true"><b></b></i>'
      +`<svg class="rescue-hex" viewBox="0 0 96 106" overflow="visible" aria-hidden="true"><defs><clipPath id="${id}c"><path d="${hex(RI)}"/></clipPath><filter id="${id}d"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="1.25"/><feFuncG type="linear" slope="1.25"/><feFuncB type="linear" slope="1.25"/></feComponentTransfer></filter>`
      +`<filter id="${id}g" filterUnits="userSpaceOnUse" x="-20" y="-20" width="136" height="146"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
      +`<path d="${hex(R+1)}" transform="translate(4.5 4.5)" fill="#dc143c"/><path d="${hex(R+1)}" fill="#0a0c15"/>`
      +`<g clip-path="url(#${id}c)"><rect width="96" height="106" fill="#151a2e"/><image class="rescue-face" filter="url(#${id}d)" preserveAspectRatio="none"/><rect width="96" height="106" fill="#dc143c" opacity=".16"/></g>`
      +`<path d="${hex(RI+.5)}" fill="none" stroke="#fff" stroke-width="2.2"/>`
      +ENDS.map(e=>`<line x1="${e[0]}" y1="${e[1]}" x2="${e[2]}" y2="${e[3]}" class="rescue-track"/>`).join('')
      +`<g class="rescue-blades" filter="url(#${id}g)">${ENDS.map(e=>`<line x1="${e[0]}" y1="${e[1]}" x2="${e[0]}" y2="${e[1]}"/>`).join('')}</g>`
      +'<path class="rescue-crack" d="M30 16 L40 36 L34 46 L50 60 L46 78 M60 22 L56 38 L66 50"/>'
      +'<g class="rescue-plus" transform="translate(70 26)"><circle r="11"/><path d="M-5.5 -1.6H-1.6V-5.5H1.6V-1.6H5.5V1.6H1.6V5.5H-1.6V1.6H-5.5Z"/></g></svg>'
      +'<div class="rescue-text"><b></b><small></small></div>';
    this.title=this.root.querySelector('.rescue-text b')!;this.detail=this.root.querySelector('.rescue-text small')!;this.arrow=this.root.querySelector('.rescue-bearing')!;
    this.face=this.root.querySelector('image')!;this.blades=[...this.root.querySelectorAll<SVGLineElement>('.rescue-blades line')];
    this.face.addEventListener('error',()=>{const list=pictures(this.fighter as never,false),next=list[list.indexOf(this.face.getAttribute('href')??'')+1];if(next)this.frame(next);});
    parent.append(this.root);
  }
  reset(){if(!this.root.classList.contains('hidden'))this.root.classList.add('hidden');this.target='';this.nextLayout=0;}
  private frame(url:string){const f=url.includes('/portraits/')?{cx:320,cy:250,crop:300,size:640}:{cx:226,cy:204,crop:190,size:512},s=2*RI*1.12/f.crop;
    this.face.setAttribute('href',url);this.face.setAttribute('x',(C-f.cx*s).toFixed(1));this.face.setAttribute('y',(C+5-f.cy*s).toFixed(1));this.face.setAttribute('width',(f.size*s).toFixed(1));this.face.setAttribute('height',(f.size*s).toFixed(1));}
  update(snapshot:GameSnapshot|undefined,ownId:string,camera:THREE.Camera){
    const mode=objectiveOf(snapshot),own=snapshot?.players.find(p=>p.id===ownId);
    if(!snapshot||mode?.kind!=='last-stand'||mode.phase!=='active'||!own?.alive){this.reset();return;}
    const gap=(p:PlayerState)=>Math.hypot(p.x-own.x,p.z-own.z);
    const fallen=mode.seats.filter(s=>s.down&&s.id!==ownId).map(s=>({seat:s,p:snapshot.players.find(p=>p.id===s.id)})).filter((s):s is {seat:typeof s.seat;p:PlayerState}=>!!s.p&&!s.p.alive);
    fallen.sort((a,b)=>gap(a.p)-gap(b.p));
    const current=fallen.find(s=>s.p.id===this.target),chosen=current&&(!fallen[0]||gap(current.p)<gap(fallen[0].p)+4)?current:fallen[0];
    if(!chosen){this.reset();return;}
    const {p,seat}=chosen;this.target=p.id;
    const distance=gap(p),sameLevel=Math.abs(p.y-own.y)<2,near=distance<=RULES.rescueRadius&&sameLevel;
    const helping=mode.seats.some(s=>{const a=snapshot.players.find(a=>a.id===s.id);return a&&s.id!==p.id&&!s.disconnected&&a.alive&&Math.abs(a.y-p.y)<2&&Math.hypot(a.x-p.x,a.z-p.z)<=RULES.rescueRadius;});
    const progress=Math.max(0,Math.min(1,seat.rescue)),name=(p.name==='Fighter'?FIGHTERS[p.fighter].name:p.name).toUpperCase();
    const title=near?`REVIVING ${name}`:name;
    const detail=near?`STAY CLOSE · ${Math.floor(progress*100)}%`:helping?`ALLY REVIVING · ${Math.floor(progress*100)}%`:sameLevel?`ALLY DOWN · ${Math.round(distance)}m`:`REACH THEIR LEVEL · ${Math.round(distance)}m`;
    if(this.title.textContent!==title)this.title.textContent=title;if(this.detail.textContent!==detail)this.detail.textContent=detail;
    if(p.fighter!==this.fighter){this.fighter=p.fighter;this.frame(pictures(p.fighter,false)[0]);}
    const share=Math.round(progress*120)/120;
    if(share!==this.shown){this.shown=share;this.blades.forEach((line,i)=>{const f=Math.max(0,Math.min(1,share*6-i)),e=ENDS[i];line.setAttribute('x2',(e[0]+(e[2]-e[0])*f).toFixed(1));line.setAttribute('y2',(e[1]+(e[3]-e[1])*f).toFixed(1));line.style.display=f>0?'':'none';});}
    this.root.dataset.helping=String(helping);this.root.dataset.near=String(near);
    this.point.set(p.x,p.y+2.2,p.z);this.view.copy(this.point).applyMatrix4(camera.matrixWorldInverse);this.point.project(camera);
    const w=innerWidth,h=innerHeight,half=w<600?83:100;
    const left=half+14,right=w-half-14,top=72,bottom=h-(h<540?105:145);
    const behind=this.view.z>=0;
    let x=(this.point.x*.5+.5)*w,y=(-this.point.y*.5+.5)*h;
    const outside=behind||x<left||x>right||y<top||y>bottom;
    let dx=x-w/2,dy=y-h/2;
    if(behind){dx=this.view.x;dy=Math.max(4,Math.abs(this.view.z)*.4);}
    if(outside){const length=Math.max(.001,Math.hypot(dx,dy));dx/=length;dy/=length;const scale=Math.min((w/2-left)/Math.max(.001,Math.abs(dx)),(h/2-top)/Math.max(.001,Math.abs(dy)));x=w/2+dx*scale;y=h/2+dy*scale;}
    x=Math.max(left,Math.min(right,x));y=Math.max(top,Math.min(bottom,y));
    const now=performance.now();if(now>=this.nextLayout){this.nextLayout=now+500;this.obstacles=[...this.parent.querySelectorAll<HTMLElement>('.objective-hud,.fighter-meter.own,.move-bar,.objective-shop-prompt,.mode-hud>[data-zone]:not([data-zone="8"])')].filter(el=>el.getClientRects().length>0).map(el=>el.getBoundingClientRect());}
    for(const box of this.obstacles)if(x+half>box.left&&x-half<box.right&&y-24<box.bottom&&y+24>box.top){const below=box.bottom+29;y=below<=bottom?below:box.top-29;}
    this.root.classList.toggle('offscreen',outside);this.arrow.style.setProperty('--bearing',`${Math.atan2(dy,dx)}rad`);
    this.root.style.left=`${x}px`;this.root.style.top=`${Math.max(top,Math.min(bottom,y))}px`;this.root.classList.remove('hidden');
  }
}
