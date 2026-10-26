import { BRANCHES, SKILL_TREE, TIERS, TIER_POINTS, TREE_NODE, branchPoints, closed, lockOf, maxRank, rankOf, refundLock, skillArt, type Branch, type SkillNode } from '../../survival/skillTree';
import { nodeInfo } from '../../survival/skillText';
import { upgrade } from '../../survival/upgrades';
import { brushStroke } from '../inkSplat';
import './skillAtlas.css';

export interface AtlasState { picks: readonly string[]; points: number; level: number }
const esc = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const COLORS = {blade:'#a92b2d',ki:'#34596c',body:'#806035'};
const CRESTS: Record<Branch,string> = {
  blade:'<path d="M26 48 51 15l-8 5-22 24m-5-5 16 13M21 49l-5 8"/>',
  ki:'<path d="M34 13c17 0 27 20 12 33-10 9-25 4-25-7 0-8 12-13 15-5 2 5-5 9-8 5m6-26C11 13 8 41 24 51m19 0c18-8 17-31 4-39"/>',
  body:'<path d="m17 32 6-3V18q4-6 8-1v12-15q5-5 8 1v14-13q5-3 8 2v14-9q6-2 6 4v13l-9 14H28l-12-15q-3-5 1-7Z"/>',
};
const crest = (branch: Branch) => `<svg viewBox="0 0 68 68" aria-hidden="true">${CRESTS[branch]}</svg>`;
const stroke = `<svg class="atlas-brush" viewBox="0 0 1000 200" preserveAspectRatio="none" aria-hidden="true"><path d="${brushStroke(17,.4)}"/></svg>`;
export const SKILL_HOLD_MS = 650;
const WIDTH = 1320, HEIGHT = 1450, COLUMN = 440;
interface Position { x: number; y: number }
export class SkillAtlas {
  private state: AtlasState = {picks:[],points:0,level:1};
  private unlocked: readonly string[] = [];
  private key = '';
  private selected = 'iron-fist';
  private branch: Branch | 'all' = 'all';
  private query = '';
  private resetPending = false;
  private zoom = .8;
  private positions = new Map<string, Position>();
  private viewport: HTMLElement;
  private space: HTMLElement;
  private graph: HTMLElement;
  private tip: HTMLElement;
  private returnFocus?: HTMLElement;
  private hold?: {id:string;pointer:number;x:number;y:number;button:HTMLElement;timer:number};
  private pendingLearn?: {id:string;rank:number;timer:number};
  private noticeTimer=0;
  private openNow=false;
  constructor(private root: HTMLElement, private choose: (id: string) => void) {
    root.classList.add('ascension'); root.setAttribute('aria-modal','true');
    root.innerHTML = `<div class="atlas-shell">
      <header class="atlas-head"><div><small>ARCADE SURVIVAL</small><h2>SKILL TREE</h2></div><b id="sv-tree-points"></b><button id="sv-tree-ready" type="button">RESUME <span>ESC</span></button></header>
      <div class="atlas-tools"><nav aria-label="Skill branches"><button data-branch="all" aria-pressed="true">ALL</button>${BRANCHES.map(b=>`<button data-branch="${b.id}" aria-pressed="false">${b.name}</button>`).join('')}</nav><label class="atlas-search">⌕ <input type="search" maxlength="60" placeholder="Find a skill…" aria-label="Find a skill"></label><span class="atlas-count" role="status"></span><button class="atlas-reset" type="button">RESET BUILD</button></div>
      <div class="atlas-body"><div class="atlas-viewport" tabindex="0" aria-label="Skill graph. Drag to pan, use arrow keys to select skills."><div class="atlas-space"><div class="atlas-graph"></div></div></div><aside class="atlas-tip" aria-label="Selected skill"></aside></div>
      <footer class="atlas-foot"><span id="sv-tree-hint"></span><div class="atlas-zoom"><button data-zoom="out" aria-label="Zoom out">−</button><output>80%</output><button data-zoom="in" aria-label="Zoom in">+</button><button data-zoom="fit">FIT</button></div></footer>
      <div class="atlas-notice" role="status" aria-live="polite"></div>
    </div>`;
    this.viewport=root.querySelector('.atlas-viewport')!;this.space=root.querySelector('.atlas-space')!;this.graph=root.querySelector('.atlas-graph')!;this.tip=root.querySelector('.atlas-tip')!;
    root.querySelectorAll<HTMLButtonElement>('[data-branch]').forEach(b=>b.onclick=()=>{this.branch=b.dataset.branch as Branch|'all';this.render();this.fit();});
    root.querySelector<HTMLButtonElement>('.atlas-reset')!.onclick=()=>this.confirmReset();
    root.querySelector<HTMLInputElement>('input')!.oninput=e=>{this.query=(e.target as HTMLInputElement).value.trim().toLowerCase();this.search();};
    root.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach(b=>b.onclick=()=>b.dataset.zoom==='fit'?this.fit():this.scale(this.zoom+(b.dataset.zoom==='in'?.1:-.1)));
    this.viewport.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();this.scale(this.zoom+(e.deltaY<0?.08:-.08));}},{passive:false});
    let drag: {id:number;x:number;y:number;left:number;top:number}|undefined;
    this.viewport.addEventListener('pointerdown',e=>{if(e.button!==0||e.pointerType==='touch'||(e.target as HTMLElement).closest('button'))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:this.viewport.scrollLeft,top:this.viewport.scrollTop};this.viewport.setPointerCapture(e.pointerId);});
    this.viewport.addEventListener('pointermove',e=>{if(!drag)return;this.viewport.scrollLeft=drag.left+drag.x-e.clientX;this.viewport.scrollTop=drag.top+drag.y-e.clientY;});
    const end=()=>{drag=undefined;};this.viewport.addEventListener('pointerup',end);this.viewport.addEventListener('pointercancel',end);this.viewport.addEventListener('lostpointercapture',end);
    root.addEventListener('pointerdown',e=>{
      if(e.button!==0||!e.isPrimary)return;
      const icon=(e.target as Element).closest('.atlas-sigil'),button=icon?.closest<HTMLElement>('[data-node]');
      if(!button)return;
      this.cancelHold();button.focus({preventScroll:true});this.inspect(button.dataset.node!);
      const id=button.dataset.node!;
      if(!this.canLearn(id))return;
      this.hold={id,pointer:e.pointerId,x:e.clientX,y:e.clientY,button,timer:window.setTimeout(()=>{
        const held=this.hold;this.cancelHold();
        if(held&&this.openNow&&!document.hidden&&this.selected===held.id)this.requestLearn(held.id);
      },SKILL_HOLD_MS)};
      button.classList.add('charging');
    });
    window.addEventListener('pointermove',e=>{const h=this.hold;if(h&&e.pointerId===h.pointer&&Math.hypot(e.clientX-h.x,e.clientY-h.y)>10)this.cancelHold();},{passive:true});
    const release=(e:PointerEvent)=>{if(e.pointerId===this.hold?.pointer)this.cancelHold();};
    window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);
    window.addEventListener('blur',()=>this.cancelHold());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.cancelHold();});
    this.viewport.addEventListener('scroll',()=>this.cancelHold(),{passive:true});
    root.addEventListener('focusout',e=>{if(this.hold&&e.target===this.hold.button)this.cancelHold();});
    root.addEventListener('contextmenu',e=>{if((e.target as Element).closest('.atlas-sigil')){e.preventDefault();}});
    root.addEventListener('keydown',e=>{
      this.cancelHold();
      if(e.key==='Tab'){
        const buttons=[...root.querySelectorAll<HTMLElement>('button:not(:disabled),input,[tabindex="0"]')].filter(el=>el.getClientRects().length);
        const i=buttons.indexOf(document.activeElement as HTMLElement),next=e.shiftKey?(i<=0?buttons.length-1:i-1):(i+1)%buttons.length;
        e.preventDefault();buttons[next]?.focus();
      }
      if((e.target as HTMLElement).tagName==='INPUT'&&e.key!=='Escape'){e.stopPropagation();}
    });
  }
  open() { this.openNow=true;this.returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:undefined;if(this.viewport.clientWidth<720&&this.branch==='all')this.branch='blade';this.render();this.fit();this.node(this.selected)?.focus({preventScroll:true}); }
  close() { const restore=this.openNow;this.openNow=false;this.cancelHold();this.clearPending();window.clearTimeout(this.noticeTimer);this.root.querySelector('.atlas-notice')!.textContent='';if(restore)this.returnFocus?.focus({preventScroll:true}); }
  private cancelHold(){if(!this.hold)return;window.clearTimeout(this.hold.timer);this.hold.button.classList.remove('charging');this.hold=undefined;}
  private clearPending(){if(this.pendingLearn)window.clearTimeout(this.pendingLearn.timer);this.pendingLearn=undefined;this.root.classList.remove('atlas-waiting');}
  private canLearn(id:string){return this.openNow&&!this.pendingLearn&&this.state.points>0&&!lockOf(this.state.picks,id,this.unlocked);}
  private requestLearn(id:string){
    if(!this.canLearn(id))return;
    this.pendingLearn={id,rank:rankOf(this.state.picks,id),timer:window.setTimeout(()=>{this.clearPending();this.notice('No unlock confirmed. Try again.');},3000)};
    this.root.classList.add('atlas-waiting');this.choose(`tree:${id}`);
  }
  private notice(text:string){const el=this.root.querySelector<HTMLElement>('.atlas-notice')!;window.clearTimeout(this.noticeTimer);el.textContent=text;this.noticeTimer=window.setTimeout(()=>{el.textContent='';},2400);}
  update(state: AtlasState, unlocked: readonly string[]) {
    this.state=state;this.unlocked=unlocked;
    const key=`${state.picks.join(',')}|${state.points}|${state.level}|${unlocked.join(',')}`;
    if(key===this.key)return;this.key=key;
    const pending=this.pendingLearn,learned=pending&&rankOf(state.picks,pending.id)>pending.rank?pending.id:undefined;
    this.cancelHold();
    if(learned)this.clearPending();
    this.root.querySelector<HTMLButtonElement>('.atlas-reset')!.disabled=!state.picks.length;
    this.root.querySelector('#sv-tree-points')!.innerHTML=`<small>LEVEL ${state.level}</small><span>${state.points}</span> POINT${state.points===1?'':'S'}`;
    this.render();
    if(learned&&this.openNow){this.node(learned)?.classList.add('just-learned');this.notice(`${upgrade(learned).name} · Rank ${rankOf(state.picks,learned)} unlocked`);}
  }
  private render() {
    this.cancelHold();
    const active=document.activeElement as HTMLElement|null;
    const restore=active&&this.root.contains(active)&&active.tagName!=='INPUT';
    const action=active?.classList.contains('atlas-learn')?'.atlas-learn':active?.classList.contains('atlas-refund')?'.atlas-refund':undefined;
    this.graph.replaceChildren();this.positions.clear();
    const branches=this.branch==='all'?BRANCHES:BRANCHES.filter(b=>b.id===this.branch);
    const width=branches.length*COLUMN;
    this.graph.style.width=`${width}px`;this.graph.style.height=`${HEIGHT}px`;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${width} ${HEIGHT}`);svg.setAttribute('aria-hidden','true');svg.classList.add('atlas-links');this.graph.append(svg);
    for(const [bi,branch] of branches.entries()){
      const cx=bi*COLUMN+COLUMN/2,spent=branchPoints(this.state.picks,branch.id);
      const title=document.createElement('div');title.className='atlas-branch';title.style.cssText=`left:${bi*COLUMN}px;width:${COLUMN}px;--branch:${COLORS[branch.id]}`;
      title.innerHTML=`<i>${crest(branch.id)}</i><strong>${stroke}<span>${branch.name}</span></strong><b>${spent} INVESTED</b>`;this.graph.append(title);
      let previous=125;
      for(const tier of [0,1,2,3] as const){
        const y=[190,410,770,1240][tier],need=TIER_POINTS[tier];
        this.link(svg,{x:cx,y:previous},{x:cx,y},spent>=need,COLORS[branch.id]);
        const gate=document.createElement('div');gate.className=`atlas-gate${spent>=need?' open':''}`;gate.style.cssText=`left:${cx}px;top:${y}px;--branch:${COLORS[branch.id]}`;gate.innerHTML=`<b>${TIERS[tier].name}</b>${spent<need?`<span>${Math.max(0,need-spent)} MORE IN ${branch.name}</span>`:''}`;this.graph.append(gate);
        const nodes=SKILL_TREE.filter(n=>n.branch===branch.id&&n.tier===tier);
        nodes.forEach((node,i)=>{
          const row=Math.floor(i/3),count=Math.min(3,nodes.length-row*3),x=cx+(i%3-(count-1)/2)*132,ny=y+93+row*135;
          this.positions.set(node.id,{x,y:ny});
          if(!node.requires)this.link(svg,{x:cx,y:y+22},{x,y:ny-29},rankOf(this.state.picks,node.id)>0,COLORS[branch.id]);
          this.graph.append(this.button(node,{x,y:ny}));
        });
        previous=y+28;
      }
    }
    for(const node of SKILL_TREE)if(node.requires){const a=this.positions.get(node.requires),b=this.positions.get(node.id);if(a&&b){const path=this.link(svg,{x:a.x,y:a.y+30},{x:b.x,y:b.y-30},rankOf(this.state.picks,node.id)>0,COLORS[node.branch],true);path.dataset.from=node.requires;path.dataset.to=node.id;}}
    this.root.querySelectorAll<HTMLButtonElement>('[data-branch]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.branch===this.branch)));
    if(!this.positions.has(this.selected))this.selected=this.positions.keys().next().value??'iron-fist';
    this.filter();this.inspect(this.selected);this.scale(this.zoom);
    if(restore){const target=action?this.tip.querySelector<HTMLButtonElement>(action):undefined;((target&&!target.disabled)?target:this.node(this.selected))?.focus({preventScroll:true});}
  }
  private link(svg: SVGSVGElement,a:Position,b:Position,on:boolean,color:string,parent=false){const line=document.createElementNS('http://www.w3.org/2000/svg','path');line.setAttribute('d',`M ${a.x} ${a.y} C ${a.x} ${(a.y+b.y)/2}, ${b.x} ${(a.y+b.y)/2}, ${b.x} ${b.y}`);line.setAttribute('stroke',on?color:parent?'#aaa398':'#d1cbbf');line.setAttribute('class',`atlas-link${on?' on':''}${parent?' parent':''}`);svg.append(line);return line;}
  private button(node:SkillNode,at:Position){
    const rank=rankOf(this.state.picks,node.id),max=maxRank(node.id),lock=lockOf(this.state.picks,node.id,this.unlocked);
    const button=document.createElement('button');button.type='button';button.dataset.node=node.id;
    button.className=`atlas-node ${node.keystone?'keystone':node.technique?'technique':'passive'}${rank?' learned':''}${!lock&&this.state.points?' available':''}${closed(this.state.picks,node.id)?' excluded':''}${lock&&!rank?' locked':''}`;
    button.style.cssText=`left:${at.x}px;top:${at.y}px;--branch:${COLORS[node.branch]}`;
    button.setAttribute('aria-label',`${upgrade(node.id).name}, rank ${rank} of ${max}${lock?`, ${lock}`:', hold icon to learn or use the Learn button'}`);
    button.innerHTML=`<span class="atlas-sigil"><svg class="atlas-charge" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36" pathLength="100"/></svg><span class="atlas-icon"><img src="/assets/survival/cards/${skillArt(node.id)}.webp" alt="" draggable="false"><i>${upgrade(node.id).kanji}</i></span></span><b class="atlas-rank">${rank}/${max}</b><strong>${esc(upgrade(node.id).name)}</strong>${node.keystone?'<small>ONE PER BUILD</small>':''}`;
    const art=button.querySelector('img')!;art.onerror=()=>art.remove();
    button.onclick=()=>this.inspect(node.id);button.onfocus=()=>this.inspect(node.id);
    return button;
  }
  private node(id:string){return this.graph.querySelector<HTMLButtonElement>(`[data-node="${id}"]`);}
  private matches(node:SkillNode){return !this.query||`${upgrade(node.id).name} ${node.line} ${node.path??''} ${node.branch}`.toLowerCase().includes(this.query);}
  private search(){
    const match=SKILL_TREE.find(n=>this.matches(n));
    if(this.query&&match){
      if(this.branch!=='all'&&this.branch!==match.branch){this.branch=match.branch;this.render();this.fit();}
      this.inspect(match.id);this.node(match.id)?.scrollIntoView({block:'center',inline:'nearest'});
    }
    this.filter();
  }
  private filter(){
    let count=0;this.graph.querySelectorAll<HTMLElement>('[data-node]').forEach(el=>{const n=TREE_NODE.get(el.dataset.node!)!;const match=this.matches(n);el.classList.toggle('search-muted',!match);el.tabIndex=match?0:-1;if(match)count++;});
    this.root.querySelector('.atlas-count')!.textContent=this.query?`${count} MATCH${count===1?'':'ES'}`:'';
  }
  private inspect(id:string){
    if(id!==this.selected)this.cancelHold();
    this.resetPending=false;this.selected=id;const node=TREE_NODE.get(id);if(!node)return;
    this.graph.querySelectorAll<HTMLElement>('[data-node]').forEach(el=>{el.classList.toggle('selected',el.dataset.node===id);el.setAttribute('aria-pressed',String(el.dataset.node===id));});
    this.graph.querySelectorAll<SVGPathElement>('.atlas-link.parent').forEach(path=>path.classList.toggle('traced',path.dataset.from===id||path.dataset.to===id));
    const info=nodeInfo(node,this.state.picks,this.state.level,this.unlocked),lock=lockOf(this.state.picks,id,this.unlocked),refund=refundLock(this.state.picks,id,this.unlocked);
    this.tip.style.setProperty('--branch',COLORS[node.branch]);
    this.tip.innerHTML=`<div class="atlas-tip-art"><img src="/assets/survival/cards/${skillArt(id)}.webp" alt=""><span>${esc(info.kanji)}</span></div><small class="atlas-tag">${info.kind} · ${info.tags.map(esc).join(' / ')}</small><h3>${esc(info.name)}</h3><div class="atlas-tip-rank">RANK ${info.rank} / ${info.max}<span>${Array.from({length:info.max},(_,i)=>`<i class="${i<info.rank?'filled':''}"></i>`).join('')}</span></div>
      ${info.now?`<section><h4>CURRENT RANK</h4><p>${esc(info.now)}</p></section>`:''}${info.next?`<section class="atlas-next"><h4>${info.rank?'NEXT RANK':'FIRST RANK'}</h4><p>${esc(info.next)}</p></section>`:''}
      <button class="atlas-learn" ${lock||!this.state.points?'disabled':''}>${lock==='mastered'?'MASTERED':lock?'LOCKED':!this.state.points?'EARN A SKILL POINT':`${info.rank?'UPGRADE':'UNLOCK SKILL'} · 1 POINT`}</button><button class="atlas-refund" ${refund?'disabled':''}>REFUND ONE RANK</button>
      <p class="atlas-hold-note">Or hold its icon. Release to cancel.</p>${info.rank?`<p class="atlas-refund-note">${esc(refund??'Returns 1 point; health and cooldowns stay as they are.')}</p>`:''}
      ${info.requires.length?`<section><h4>REQUIREMENTS</h4><ul>${info.requires.map(r=>`<li class="${r.met?'met':'unmet'}">${r.met?'✓':'◇'} ${esc(r.text)}</li>`).join('')}</ul></section>`:''}
      ${info.seals.length?`<section class="atlas-exclusive"><h4>EXCLUSIVE CHOICE</h4><p>${esc(info.seals.join(' · '))} stays locked until this choice is refunded.</p></section>`:''}
      `;
    const art=this.tip.querySelector('img')!;art.onerror=()=>art.remove();
    this.tip.querySelector<HTMLButtonElement>('.atlas-learn')!.onclick=()=>this.learn();
    this.tip.querySelector<HTMLButtonElement>('.atlas-refund')!.onclick=()=>{if(!refundLock(this.state.picks,id,this.unlocked))this.choose(`tree:refund:${id}`);};
  }
  refund(){this.cancelHold();if(this.resetPending){this.inspect(this.selected);return;}if(!refundLock(this.state.picks,this.selected,this.unlocked))this.choose(`tree:refund:${this.selected}`);}
  private confirmReset(){
    this.cancelHold();
    if(!this.state.picks.length)return;this.resetPending=true;
    this.tip.innerHTML=`<small class="atlas-tag">A NEW PATH</small><h3>Reset this build?</h3><section><p>Return all <strong>${this.state.picks.length} invested points</strong> and choose a different path. Your relics and unlocked skills stay with you.</p></section><section><p>Health percentage, spent revives and cooldowns are preserved.</p></section><button class="atlas-confirm-reset atlas-learn">REFUND ALL POINTS</button><button class="atlas-cancel-reset atlas-refund">KEEP MY BUILD</button>`;
    this.tip.querySelector<HTMLButtonElement>('.atlas-confirm-reset')!.onclick=()=>this.reset();
    const cancel=this.tip.querySelector<HTMLButtonElement>('.atlas-cancel-reset')!;cancel.onclick=()=>this.inspect(this.selected);cancel.focus();
  }
  private reset(){this.resetPending=false;this.choose('tree:reset');}
  learn(){if(this.resetPending){if(document.activeElement?.classList.contains('atlas-confirm-reset'))this.reset();else this.inspect(this.selected);return;}this.cancelHold();this.requestLearn(this.selected);}
  move(dx:number,dy:number){
    const from=this.positions.get(this.selected);if(!from)return;
    let best='',score=Infinity;
    for(const [id,at] of this.positions){if(id===this.selected||this.node(id)?.classList.contains('search-muted'))continue;const x=at.x-from.x,y=at.y-from.y,along=dx?x*dx:y*dy,across=dx?Math.abs(y):Math.abs(x);if(along<8)continue;const s=along+across*2.2;if(s<score){best=id;score=s;}}
    if(best){this.inspect(best);this.node(best)?.focus({preventScroll:true});this.node(best)?.scrollIntoView({block:'nearest',inline:'nearest'});}
  }
  private fit(){this.scale(Math.min(1,(this.viewport.clientWidth-28)/(this.branch==='all'?WIDTH:COLUMN)));this.viewport.scrollTop=0;this.viewport.scrollLeft=0;if(this.viewport.clientHeight<320)this.node(this.selected)?.scrollIntoView({block:'nearest',inline:'nearest'});}
  private scale(value:number){this.cancelHold();this.zoom=Math.max(.65,Math.min(1.5,value));this.graph.style.transform=`scale(${this.zoom})`;this.space.style.width=`${(this.branch==='all'?WIDTH:COLUMN)*this.zoom}px`;this.space.style.height=`${HEIGHT*this.zoom}px`;this.root.querySelector('output')!.textContent=`${Math.round(this.zoom*100)}%`;}
}
