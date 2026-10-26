import { randomInt } from 'node:crypto';
import { clusterIndex, clusterSize } from './cluster/link';

export class PrivateCodes {
  private active = new Set<string>();
  constructor(private readonly next = () => randomInt(0, 1_000_000).toString().padStart(6, '0')) {}
  allocate(): string {
    for (let tries=0;tries<128;tries++) {
      const code=this.next();
      if(!/^\d{6}$/.test(code))throw new Error('Invalid room-code generator');
      if(!this.active.has(code)){this.active.add(code);return code;}
    }
    throw new Error('Private rooms are busy. Please try again.');
  }
  release(code:string){this.active.delete(code);}
  has(code:string){return this.active.has(code);}
}
export function clusterCodes(index=clusterIndex(),size=clusterSize()):(()=>string)|undefined{
  if(!(size>1)||!(index>=1&&index<=size))return undefined;
  const span=Math.floor(1_000_000/size);
  return ()=>(randomInt(0,span)*size+index-1).toString().padStart(6,'0');
}
export const privateCodes=new PrivateCodes(clusterCodes());
export const PRIVATE_WAIT_SECONDS=15*60;
