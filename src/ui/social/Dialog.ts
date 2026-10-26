import {nearest,type Direction} from '../spatialFocus';
import type {UiAction} from '../../input/gamepad';
export class SocialDialog {
  readonly element=document.createElement('dialog');
  private focus:HTMLElement|null=null;
  private editing:HTMLInputElement|null=null;private digit=0;
  constructor(root:HTMLElement,label:string){this.element.className='social-dialog';this.element.setAttribute('aria-label',label);root.append(this.element);this.element.addEventListener('close',()=>this.focus?.focus({preventScroll:true}));this.element.addEventListener('click',e=>{if((e.target as Element).closest('[data-social-close]'))this.close();});}
  show(){if(this.element.open)return;this.focus=document.activeElement as HTMLElement;document.exitPointerLock?.();this.element.showModal();}
  close(){this.editing=null;this.element.close();}
  get open(){return this.element.open;}
  controller(action:UiAction){
    if(!this.open)return false;
    if(this.editing){const input=this.editing;if(action==='back'||action==='confirm'){this.editing=null;return true;}const digits=input.value.padEnd(6,'0').split('');if(action==='left'||action==='right')this.digit=(this.digit+(action==='right'?1:5))%6;else digits[this.digit]=String((Number(digits[this.digit])+(action==='next'?1:9))%10);input.value=digits.join('');input.dispatchEvent(new Event('input',{bubbles:true}));input.setSelectionRange(this.digit,this.digit+1);return true;}
    if(action==='back'){this.close();return true;}
    const items=[...this.element.querySelectorAll<HTMLElement>('button,input,select')].filter(e=>e.getBoundingClientRect().width&&!(e as HTMLButtonElement).disabled),active=document.activeElement as HTMLElement;
    if(!items.includes(active)){items[0]?.focus();return true;}
    if(active instanceof HTMLSelectElement&&(action==='left'||action==='right')){active.selectedIndex=(active.selectedIndex+(action==='right'?1:active.options.length-1))%active.options.length;active.dispatchEvent(new Event('change',{bubbles:true}));return true;}
    if(action==='confirm'){if(active instanceof HTMLInputElement){active.focus();if(active.inputMode==='numeric'){this.editing=active;this.digit=0;active.value=active.value.padEnd(6,'0');active.dispatchEvent(new Event('input',{bubbles:true}));active.setSelectionRange(0,1);}}else active.click();return true;}
    const dir=({previous:'up',next:'down',left:'left',right:'right'} as Record<string,Direction>)[action],i=nearest(active.getBoundingClientRect(),items.map(e=>e.getBoundingClientRect()),dir);if(i>=0)items[i].focus();return true;
  }
}
