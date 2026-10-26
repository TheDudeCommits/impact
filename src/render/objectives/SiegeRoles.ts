import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {GameSnapshot} from '../../game/types';
import type {VillageView} from '../../game/objectives/lastStand';
import {ENEMIES} from '../../survival/enemies';
import type {SpecialistRole} from '../../game/objectives/siegeSpecialists';
const COLOURS={captain:0x80cde7,medic:0x89e4b6,sapper:0xff805c};
export class SiegeRoles {
  readonly root=new THREE.Group();
  private units=new Map<string,{root:THREE.Group;badge:THREE.Sprite;charge:THREE.Mesh}>();
  private box=new THREE.BoxGeometry(1,1,1);
  private equipment:THREE.MeshStandardMaterial[]=[];
  private metal=new THREE.MeshStandardMaterial({color:0x283541,roughness:.6,metalness:.55});
  private wood=new THREE.MeshStandardMaterial({color:0x91704a,roughness:1});
  private colours=Object.fromEntries(Object.entries(COLOURS).map(([k,color])=>[k,new THREE.MeshBasicMaterial({color})])) as Record<SpecialistRole,THREE.MeshBasicMaterial>;
  private badges:Record<SpecialistRole,THREE.SpriteMaterial>;
  private linkPositions=new Float32Array(180*3);private links:THREE.LineSegments;
  private emergency=new THREE.Group();private wagon=new THREE.Group();private cargo=new THREE.Group();private eventBadge:THREE.Sprite;
  private prepared?:Promise<void>;
  constructor(){
    const texture=new THREE.Texture();texture.colorSpace=THREE.SRGBColorSpace;
    for(let i=0;i<4;i++){const panel=texture.clone();panel.repeat.set(.5,.5);panel.offset.set(i%2*.5,i<2?.5:0);texture.addEventListener('dispose',()=>panel.dispose());this.equipment.push(new THREE.MeshStandardMaterial({map:panel,color:0xffffff,roughness:.85,side:THREE.DoubleSide}));}
    this.badges=Object.fromEntries((['captain','medic','sapper'] as const).map(role=>[role,new THREE.SpriteMaterial({map:this.label(role==='captain'?'◆':role==='medic'?'✦':'!',COLOURS[role]),depthWrite:false,sizeAttenuation:false})])) as Record<SpecialistRole,THREE.SpriteMaterial>;
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(this.linkPositions,3).setUsage(THREE.DynamicDrawUsage));geo.setDrawRange(0,0);
    this.links=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x90d9d4,transparent:true,opacity:.5,depthWrite:false}));this.links.frustumCulled=false;
    this.root.add(this.links,this.emergency);this.emergency.add(this.wagon,this.cargo);
    for(const [w,h,d,x,y,z,mat] of [[1.15,.9,.85,0,.45,0,this.wood],[1.2,.12,.91,0,.12,0,this.metal],[1.2,.12,.91,0,.74,0,this.metal],[.12,.92,.91,-.38,.45,0,this.metal],[.12,.92,.91,.38,.45,0,this.metal]] as const)this.part(this.cargo,w,h,d,x,y,z,mat);
    this.part(this.wagon,2.8,.3,1.6,0,.75,0,this.wood);
    for(const x of [-1,1])for(const z of [-.85,.85]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(.48,.1,6,12),this.metal);wheel.position.set(x,.5,z);this.wagon.add(wheel);}
    const canopy=new THREE.CylinderGeometry(.76,.76,1.75,16,1,true,0,Math.PI);canopy.rotateZ(Math.PI/2);
    const cover=new THREE.Mesh(canopy,this.equipment[3]);cover.position.y=1.3;this.wagon.add(cover);
    for(const x of [-.86,.86]){const hoop=new THREE.Mesh(new THREE.TorusGeometry(.77,.035,4,16,Math.PI),this.metal);hoop.rotation.y=Math.PI/2;hoop.position.set(x,1.3,0);this.wagon.add(hoop);}
    for(let i=0;i<4;i++){const beam=this.part(this.wagon,.2,.18,2.4,(i-1.5)*.6,.3,-1.15,this.wood);beam.rotation.y=.4+i*.25;}
    this.eventBadge=new THREE.Sprite(new THREE.SpriteMaterial({map:this.label('!',0xf0d08a),depthWrite:false,sizeAttenuation:false}));this.eventBadge.scale.set(.028,.028,1);this.eventBadge.position.y=3;this.emergency.add(this.eventBadge);
  }
  prepare(){
    return this.prepared??=Promise.all([
      new THREE.TextureLoader().loadAsync('/assets/environment/objectives/specialist-materials.webp').then(texture=>{
        for(const m of this.equipment){m.map!.source=texture.source;m.map!.needsUpdate=true;}
      }).catch(()=>{}),
      new GLTFLoader().loadAsync('/assets/survival/motion/prop-cart.glb').then(g=>{
        const bounds=new THREE.Box3().setFromObject(g.scene),size=bounds.getSize(new THREE.Vector3()),scale=3.2/Math.max(size.x,size.z);
        g.scene.scale.setScalar(scale);g.scene.position.set(-(bounds.min.x+size.x/2)*scale,-bounds.min.y*scale,-(bounds.min.z+size.z/2)*scale);this.wagon.add(g.scene);
        this.wagon.children.slice(0,5).forEach(o=>o.visible=false);
      }).catch(()=>{}),
    ]).then(()=>{});
  }
  private label(text:string,color:number){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d')!;g.fillStyle='#10191de8';g.beginPath();g.moveTo(32,0);g.lineTo(64,32);g.lineTo(32,64);g.lineTo(0,32);g.closePath();g.fill();g.fillStyle='#'+color.toString(16).padStart(6,'0');g.font='bold 44px sans-serif';g.textAlign='center';g.fillText(text,32,48);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
  private part(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material){const mesh=new THREE.Mesh(this.box,mat);mesh.scale.set(w,h,d);mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
  private make(role:SpecialistRole){
    const root=new THREE.Group(),badge=new THREE.Sprite(this.badges[role]);root.add(badge);badge.scale.set(.023,.023,1);
    const charge=this.part(root,.7,.04,.04,0,2.3,0,this.colours[role]);this.root.add(root);return {root,badge,charge};
  }
  reset(){for(const u of this.units.values()){u.root.removeFromParent();}this.units.clear();this.emergency.visible=false;this.links.geometry.setDrawRange(0,0);}
  update(v:VillageView,snapshot:GameSnapshot){
    const states=new Map(snapshot.players.map(p=>[p.id,p])),live=new Set<string>();let n=0;const now=snapshot.serverTime;
    for(const role of v.specialists??[]){const p=states.get(role.id);if(!p?.alive)continue;live.add(p.id);let unit=this.units.get(p.id);if(!unit){unit=this.make(role.role);this.units.set(p.id,unit);}
      const height=ENEMIES[p.enemy??'']?.height??1.8;unit.root.position.set(p.x,p.y,p.z);unit.root.rotation.y=p.yaw;unit.root.scale.setScalar(height/1.8);unit.badge.position.y=2.55;
      unit.charge.visible=role.charging>now;unit.charge.scale.x=Math.max(.01, .7*(role.charging>now?1-(role.charging-now)/(role.charging-role.started):0));
      const linked=role.role==='captain'?(now%3<.28?role.linked:[]):now-role.pulse<.45?role.linked:[];
      for(const id of linked){const a=states.get(id);if(!a?.alive||n+6>this.linkPositions.length)continue;this.linkPositions.set([p.x,p.y+1.4,p.z,a.x,a.y+1.2,a.z],n);n+=6;}
    }
    for(const [id,u] of this.units)if(!live.has(id)){u.root.removeFromParent();this.units.delete(id);}
    this.links.geometry.setDrawRange(0,n/3);if(n)(this.links.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;
    const e=v.emergency;this.emergency.visible=!!e&&e.phase==='active';if(!e||!this.emergency.visible)return;
    const carrier=e.carrier?states.get(e.carrier):undefined;this.emergency.position.set(e.x,carrier?.alive?carrier.y+1.1:0,e.z);this.emergency.rotation.y=carrier?.alive?carrier.yaw:0;
    this.cargo.visible=e.kind==='supplies';this.wagon.visible=e.kind==='rescue';this.eventBadge.position.y=carrier?.alive?1.5:2.3;
    if(carrier?.alive){this.cargo.position.z=-.65;this.cargo.scale.setScalar(.7);}else{this.cargo.position.z=0;this.cargo.scale.setScalar(1);}
  }
}
