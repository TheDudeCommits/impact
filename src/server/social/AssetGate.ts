import type {Room,Client} from 'colyseus';
import type {GameSnapshot} from '../../game/types';
import {assetSignature} from '../../game/social/assets';
export class AssetGate {
  private expected=new Set<string>();private loaded=new Map<string,string>();private since=0;
  constructor(private room:Room){room.onMessage('assets-ready',(c,value:unknown)=>{if(typeof value==='string'&&value.length<800)this.loaded.set(c.sessionId,value);});}
  add(c:Client,enabled:unknown){if(enabled===true)this.expected.add(c.sessionId);}
  remove(id:string){this.expected.delete(id);this.loaded.delete(id);}
  shift(ms:number){if(this.since)this.since+=ms;}
  ready(s:GameSnapshot){
    const signature=assetSignature(s),waiting=this.room.clients.filter(c=>this.expected.has(c.sessionId)&&this.loaded.get(c.sessionId)!==signature);
    if(!waiting.length){this.since=0;return true;}
    this.since||=Date.now();if(Date.now()-this.since>90000)for(const c of waiting){c.send('notice',{message:'Loading took too long. Return home and retry.'});c.leave(4008);this.remove(c.sessionId);}return false;
  }
}
