import type {ObjectiveView} from '../../game/objectives/model';
export class FighterLevelHud {
  readonly root=document.createElement('div');
  private level:HTMLElement;private detail:HTMLElement;private bar:HTMLElement;private notice:HTMLElement;
  constructor(){
    this.root.className='stand-level hidden';
    this.root.innerHTML='<div><b></b><span></span></div><i><em></em></i><small role="status"></small>';
    this.level=this.root.querySelector('b')!;this.detail=this.root.querySelector('span')!;this.bar=this.root.querySelector('em')!;this.notice=this.root.querySelector('small')!;
  }
  hide(){this.root.classList.add('hidden');}
  update(v:ObjectiveView,id:string,now:number){
    const progress=v.seats.find(s=>s.id===id)?.progress;
    this.root.classList.toggle('hidden',v.kind!=='last-stand'||v.phase!=='active'||!progress);if(!progress)return;
    const text=(el:HTMLElement,value:string)=>{if(el.textContent!==value)el.textContent=value;};
    const {level,xp,next,leveledAt,healedAt}=progress;
    text(this.level,`LV ${level}`);text(this.detail,`${Math.floor(xp)} / ${next} XP`);
    this.bar.style.width=`${Math.min(100,xp/next*100)}%`;
    const restored=healedAt>=0&&now-healedAt<4,up=leveledAt>=0&&now-leveledAt<3;
    text(this.notice,restored?'HEALTH RESTORED':up?'LEVEL UP · POWER INCREASED':`FULL HEAL AT LV ${Math.floor(level/5)*5+5}`);
    this.root.classList.toggle('level-up',restored||up);
    this.root.title=`Your damage and KOs earn XP. Level ${level}: +${(level-1)*8}% damage and max health; +${(level-1)*5}% stamina and recovery; faster movement, cooldowns and meters. No skill tree.`;
  }
}
