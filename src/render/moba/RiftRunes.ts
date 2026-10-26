import * as THREE from 'three';
import type {RiftRune} from '../../game/moba/model';
import type {PlayerState} from '../../game/types';
import {mergeParts} from './palette';
interface Mark {root:THREE.Group;sigil:THREE.Mesh;label:THREE.Sprite}
export class RiftRunes {
  readonly root=new THREE.Group();
  private marks=new Map<string,Mark>();
  update(runes:readonly RiftRune[],time:number,own:PlayerState|undefined){
    for(const rune of runes){
      let mark=this.marks.get(rune.id);if(!mark){mark=this.make(rune);this.marks.set(rune.id,mark);this.root.add(mark.root);}
      mark.root.visible=rune.available&&!rune.hidden;if(!mark.root.visible)continue;
      mark.root.position.set(rune.x,rune.y,rune.z);mark.sigil.position.y=1.2+Math.sin(time*1.8)*.12;mark.sigil.rotation.y=time*.4;
      mark.label.visible=!!own&&(own.x-rune.x)**2+(own.z-rune.z)**2<18*18;
    }
  }
  private make(rune:RiftRune):Mark {
    const recovery=rune.kind==='recovery',color=recovery?0xb8e196:0x83d5dc,root=new THREE.Group();
    const ring=new THREE.Mesh(new THREE.RingGeometry(1.5,1.62,32).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,depthWrite:false}));ring.position.y=.055;root.add(ring);
    const geometry=recovery?mergeParts([new THREE.BoxGeometry(.22,.8,.2),new THREE.BoxGeometry(.7,.22,.2),new THREE.TorusGeometry(.56,.035,4,24)]):mergeParts([new THREE.OctahedronGeometry(.4).scale(.8,1.6,.6),new THREE.TorusGeometry(.65,.035,4,24).rotateX(.6)]);
    const sigil=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color}));root.add(sigil);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const c=canvas.getContext('2d')!;c.fillStyle='#112820df';c.fillRect(6,5,244,54);c.strokeStyle=recovery?'#b8e196':'#83d5dc';c.lineWidth=2;c.strokeRect(6,5,244,54);c.fillStyle='#e6edcf';c.textAlign='center';c.textBaseline='middle';c.font='bold 23px Arial';c.fillText(recovery?'RECOVERY':'HASTE',128,34);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false,transparent:true}));label.scale.set(2.8,.7,1);label.position.y=2.5;root.add(label);return {root,sigil,label};
  }
  clear(){for(const m of this.marks.values())m.root.visible=false;}
  dispose(){this.root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();(o.material as THREE.Material).dispose();}else if(o instanceof THREE.Sprite){o.material.map?.dispose();o.material.dispose();}});this.marks.clear();this.root.removeFromParent();}
}
