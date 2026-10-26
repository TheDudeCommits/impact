import { ACTION_LABELS, bindKey, bindPad, isCapturingBinding, PAD_BUTTONS, setBindingCapture, type BindingAction, type CombatAction } from '../input/bindings';

export class BindingEditor {
  private cleanup?:()=>void;
  constructor(private root:HTMLElement,private render:()=>void){}
  cancel(){this.cleanup?.();}
  start(button:HTMLButtonElement,controller:boolean){
    this.cancel();const action=button.dataset.bind as BindingAction,index=Number(button.dataset.bindSlot||0);
    if(controller&&action==='awaken'){const status=this.root.querySelector<HTMLElement>('#binding-status');if(status)status.textContent='On a controller, Awaken is Ultimate and Area pressed together: rebind those two.';return;}
    const selector=`[data-bind="${action}"][data-bind-slot="${index}"]`;
    setBindingCapture(true);button.classList.add('binding-listening');button.setAttribute('aria-pressed','true');button.textContent='…';
    const status=this.root.querySelector<HTMLElement>('#binding-status')!;
    status.textContent=`${ACTION_LABELS[action]}: ${controller?'press a controller button':'press a key or mouse button'} · Esc to cancel`;
    let frame=0,done=false;
    const finish=()=>{if(done)return;done=true;cancelAnimationFrame(frame);window.removeEventListener('keydown',key,true);window.removeEventListener('mousedown',mouse,true);window.removeEventListener('blur',finish);this.cleanup=undefined;setBindingCapture(false);this.render();this.root.querySelector<HTMLButtonElement>(selector)?.focus({preventScroll:true});};
    const key=(event:KeyboardEvent)=>{
      event.preventDefault();event.stopImmediatePropagation();if(event.code==='Escape'){finish();return;}
      if(controller||event.repeat)return;
      if(event.metaKey||event.ctrlKey&&event.code!=='ControlLeft'&&event.code!=='ControlRight'||event.altKey&&event.code!=='AltLeft'&&event.code!=='AltRight')return;
      if(bindKey(action,index,event.code))finish();else status.textContent='That key is reserved. Choose another key · Esc to cancel';
    };
    const mouse=(event:MouseEvent)=>{if(controller)return;event.preventDefault();event.stopImmediatePropagation();if(bindKey(action,index,`Mouse${event.button}`)){
      const remove=()=>{window.removeEventListener('click',stop,true);window.removeEventListener('auxclick',stop,true);};const stop=(e:MouseEvent)=>{if(e.button!==event.button)return;e.preventDefault();e.stopImmediatePropagation();remove();};window.addEventListener('click',stop,true);window.addEventListener('auxclick',stop,true);setTimeout(remove,500);finish();
    }};
    const read=()=>Array.from(navigator.getGamepads?.()??[]).filter(p=>p?.connected&&p.mapping==='standard');
    const down=(p:Gamepad)=>p.buttons.map((b,i)=>i===6||i===7?b.value>=.55:b.pressed||b.value>=.6);
    const previous=new Map(read().map(p=>[`${p!.index}:${p!.id}`,down(p!)]));
    const poll=()=>{if(!isCapturingBinding())return;for(const pad of read())if(pad){const id=`${pad.index}:${pad.id}`,buttons=down(pad),last=previous.get(id);previous.set(id,buttons);if(!last)continue;const pressed=PAD_BUTTONS.find(i=>buttons[i]&&!last[i]);if(pressed!==undefined&&bindPad(action as CombatAction,pressed)){finish();return;}}frame=requestAnimationFrame(poll);};
    window.addEventListener('keydown',key,true);window.addEventListener('mousedown',mouse,true);window.addEventListener('blur',finish);this.cleanup=finish;if(controller)frame=requestAnimationFrame(poll);
  }
}
