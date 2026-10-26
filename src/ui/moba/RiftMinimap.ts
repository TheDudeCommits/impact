import type {GameSnapshot} from '../../game/types';
import {RIFT_BASES,RIFT_PATHS,RIFT_BOSS,RIFT_BOUNDS,RIFT_RIDGES} from '../../game/moba/map';
import {type RiftView,type RiftTeam} from '../../game/moba/model';
const colours:Record<RiftTeam|'neutral',string>={heroes:'#72d9c6',villains:'#fa8270',neutral:'#e8ca87'};
const SIZE=192,PAD=12;
const point=(n:number)=>PAD+(n+RIFT_BOUNDS.halfX)/(RIFT_BOUNDS.halfX*2)*(SIZE-PAD*2);
export class RiftMinimap {
  readonly canvas=document.createElement('canvas');
  private base=document.createElement('canvas');
  private fog=document.createElement('canvas');
  private ctx:CanvasRenderingContext2D;private last=-Infinity;
  constructor(resolution=SIZE){
    this.canvas.width=this.canvas.height=this.base.width=this.base.height=this.fog.width=this.fog.height=resolution;
    this.canvas.setAttribute('aria-label','Tactical map. Jade is Dawn Alliance; vermilion is Eclipse Legion.');this.canvas.setAttribute('role','img');
    this.ctx=this.canvas.getContext('2d')!;const c=this.base.getContext('2d')!;const scale=resolution/SIZE;this.ctx.setTransform(scale,0,0,scale,0,0);c.setTransform(scale,0,0,scale,0,0);this.fog.getContext('2d')!.setTransform(scale,0,0,scale,0,0);
    c.fillStyle='#192724';c.fillRect(0,0,SIZE,SIZE);
    c.strokeStyle='#3b615c';c.lineWidth=8;c.beginPath();c.moveTo(0,0);c.lineTo(SIZE,SIZE);c.stroke();
    c.fillStyle='#77755b';for(const b of RIFT_RIDGES)c.fillRect(point(b.x-b.halfX),point(b.z-b.halfZ),b.halfX*2,b.halfZ*2);
    for(const points of Object.values(RIFT_PATHS)){c.lineWidth=5;c.strokeStyle='#71766a';c.lineJoin='round';c.beginPath();for(let i=0;i<points.length;i++){const p=points[i];if(i)c.lineTo(point(p.x),point(p.z));else c.moveTo(point(p.x),point(p.z));}c.stroke();}
    for(const [team,p] of Object.entries(RIFT_BASES)){c.fillStyle=team==='heroes'?'#345449':'#5c3b36';c.beginPath();c.arc(point(p.x),point(p.z),15,0,Math.PI*2);c.fill();}
    c.strokeStyle='#839285';c.lineWidth=1;c.strokeRect(.5,.5,SIZE-1,SIZE-1);
  }
  update(snapshot:GameSnapshot,view:RiftView,selfId:string,now:number){
    if(now-this.last<100)return;this.last=now;const c=this.ctx;c.clearRect(0,0,SIZE,SIZE);c.drawImage(this.base,0,0,SIZE,SIZE);
    const ownSeat=view.seats.find(s=>s.id===selfId);
    if(ownSeat){c.strokeStyle='#d8c794';c.lineWidth=2;c.lineJoin='round';c.beginPath();for(const [i,p] of RIFT_PATHS[ownSeat.lane].entries()){if(i)c.lineTo(point(p.x),point(p.z));else c.moveTo(point(p.x),point(p.z));}c.stroke();}
    for(const s of view.structures){if(s.hp<=0)continue;c.fillStyle=colours[s.team];c.globalAlpha=s.vulnerable?1:.6;const size=s.kind==='core'?7:s.kind==='barracks'?4:3;c.fillRect(point(s.x)-size/2,point(s.z)-size/2,size,size);}
    c.globalAlpha=1;
    if(view.vision){
      const fog=this.fog.getContext('2d')!;fog.globalCompositeOperation='source-over';fog.clearRect(0,0,SIZE,SIZE);fog.fillStyle='#030c0bc9';fog.fillRect(0,0,SIZE,SIZE);fog.globalCompositeOperation='destination-out';fog.fillStyle='#fff';
      for(const circle of view.vision.circles){fog.beginPath();fog.arc(point(circle.x),point(circle.z),circle.radius/168*(SIZE-PAD*2),0,Math.PI*2);fog.fill();}
      fog.globalCompositeOperation='source-over';c.drawImage(this.fog,0,0,SIZE,SIZE);
    }
    for(const rune of view.runes){if(!rune.available||rune.hidden)continue;c.fillStyle=rune.kind==='recovery'?'#b8e196':'#83d5dc';c.fillRect(point(rune.x)-1.5,point(rune.z)-1.5,3,3);}
    for(const u of view.units){if(u.hp<=0)continue;c.fillStyle=colours[u.team];const r=u.kind==='boss'?4:u.kind==='siege'?2:1.25;c.beginPath();c.arc(point(u.x),point(u.z),r,0,Math.PI*2);c.fill();}
    for(const p of snapshot.players){if(!p.alive)continue;const seat=view.seats.find(s=>s.id===p.id);if(!seat)continue;const x=point(p.x),z=point(p.z);c.fillStyle=p.id===selfId?'#fffcec':colours[seat.team];c.strokeStyle='#14211e';c.lineWidth=1.5;c.beginPath();c.arc(x,z,p.id===selfId?4.5:3,0,Math.PI*2);c.fill();c.stroke();if(p.id===selfId){c.strokeStyle='#fffcec';c.lineWidth=1;c.beginPath();c.moveTo(x,z);c.lineTo(x+Math.sin(p.yaw)*10,z+Math.cos(p.yaw)*10);c.stroke();}}
    if(!view.units.some(u=>u.kind==='boss'&&u.hp>0)){c.globalAlpha=.45;c.strokeStyle=colours.neutral;c.beginPath();c.arc(point(RIFT_BOSS.x),point(RIFT_BOSS.z),3,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
    for(const e of view.events){if(e.hidden||e.kind!=='ping'||snapshot.serverTime-e.at>4)continue;const age=snapshot.serverTime-e.at;c.strokeStyle=colours[e.team??'neutral'];c.lineWidth=2;c.globalAlpha=1-age/4;c.beginPath();c.arc(point(e.x),point(e.z),5+(age*4)%8,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
  }
}
