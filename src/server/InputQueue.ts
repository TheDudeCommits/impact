import {validateInput} from '../game/simulation';
import type {PlayerInput} from '../game/types';

export class InputQueue {
  private commands:PlayerInput[]=[];
  private received=-1;
  private warming=0;
  private running=false;
  private depths:number[]=[];
  private depthAt=0;
  static readonly CAPACITY=60;
  static readonly BUFFER_TICKS=3;
  static readonly LOW_WINDOW=30;

  push(raw:unknown) {
    const input=validateInput(raw);
    if(!input||input.seq<=this.received||this.commands.length>=InputQueue.CAPACITY)return false;
    this.received=input.seq;this.commands.push(input);return true;
  }
  take():PlayerInput|undefined {
    this.depths[this.depthAt]=this.commands.length;this.depthAt=(this.depthAt+1)%InputQueue.LOW_WINDOW;
    if(!this.commands.length){this.running=false;this.warming=0;return;}
    if(!this.running){
      this.warming++;
      if(this.commands.length<InputQueue.BUFFER_TICKS&&this.warming<InputQueue.BUFFER_TICKS)return;
      this.running=true;
    }
    return this.commands.shift();
  }
  get low(){return this.depths.length?Math.min(...this.depths):this.commands.length;}
  clear(){this.commands.length=0;this.running=false;this.warming=0;this.depths.length=0;this.depthAt=0;}
  get length(){return this.commands.length;}
}
