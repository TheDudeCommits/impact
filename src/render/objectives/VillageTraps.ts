import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {TRAP_SITES,TRAP_THEMES} from '../../game/objectives/siegeTraps';
import type {TrapTheme} from '../../game/objectives/siegeChapters';
import type {VillageView} from '../../game/objectives/lastStand';

export class VillageTraps {
  readonly root=new THREE.Group();
  private styles=new Map<TrapTheme,THREE.Group>();
  private snares:THREE.Object3D[]=[];private payloads:THREE.Object3D[]=[];
  private sparks:THREE.Points;private positions=new Float32Array(3*24*3);
  private wood=new THREE.MeshStandardMaterial({color:0x513e30,roughness:.95});
  private iron=new THREE.MeshStandardMaterial({color:0x34383a,metalness:.65,roughness:.6});
  private rope=new THREE.MeshStandardMaterial({color:0xa59474,roughness:1});
  private stone=new THREE.MeshStandardMaterial({color:0x6f7778,roughness:1});
  private paper:THREE.MeshStandardMaterial;
  constructor(){
    const c=document.createElement('canvas');c.width=128;c.height=256;const g=c.getContext('2d')!;
    g.fillStyle='#c8ba92';g.fillRect(0,0,128,256);g.strokeStyle='#792d28';g.lineWidth=8;g.strokeRect(9,9,110,238);
    g.fillStyle='#222926';g.font='bold 52px serif';g.textAlign='center';g.fillText('封',64,78);g.fillText('印',64,145);
    g.lineWidth=3;for(let i=0;i<4;i++){g.beginPath();g.moveTo(28,168+i*14);g.lineTo(101-(i%2)*18,168+i*14);g.stroke();}
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    this.paper=new THREE.MeshStandardMaterial({map:texture,roughness:1,side:THREE.DoubleSide});
    for(const theme of ['wire','purify','harpoon','discharge'] as const){
      const group=new THREE.Group();this.styles.set(theme,group);this.root.add(group);
      for(const site of TRAP_SITES){
        const snare=new THREE.Group(),payload=new THREE.Group();snare.position.set(site.x,0,site.z);payload.position.copy(snare.position);group.add(snare,payload);this.snares.push(snare);this.payloads.push(payload);
        for(const x of [-4.5,4.5]){
          this.box(snare,.85,.22,.85,x,.11,0,this.stone);
          if(theme==='purify'){
            this.box(snare,.58,1.05,.58,x,.7,0,this.stone);this.box(snare,.82,.16,.82,x,1.3,0,this.iron);
            const roof=new THREE.Mesh(new THREE.ConeGeometry(.7,.4,4),this.stone);roof.rotation.y=Math.PI/4;roof.position.set(x,1.58,0);snare.add(roof);
            this.tag(snare,x,1.06,.31,.42);
          }else{
            this.cylinder(snare,.22,.28,1.3,x,.84,0,this.wood);
            for(const y of [.34,.58,1.2])this.cylinder(snare,.24,.24,.09,x,y,0,this.iron);
            for(let i=0;i<4;i++){const t=new THREE.Mesh(new THREE.TorusGeometry(.245,.035,4,10),this.rope);t.rotation.x=Math.PI/2;t.position.set(x,.77+i*.06,0);snare.add(t);}
            for(const z of [-.24,.24])this.box(snare,.13,.19,.03,x,.48,z,this.iron);
          }
        }
        if(theme!=='purify'){
          for(const y of [.29,.5])this.cord(snare,[new THREE.Vector3(-4.5,y,0),new THREE.Vector3(0,y-.08,.05),new THREE.Vector3(4.5,y,0)],theme==='harpoon'?.035:.012,theme==='discharge'?this.iron:this.rope);
          if(theme==='wire')for(const x of [-2.8,0,2.8])this.tag(snare,x,.28,.05,.21);
          if(theme==='harpoon'){
            const axle=this.cylinder(snare,.11,.11,1.1,-4.8,.72,-.5,this.iron);axle.rotation.z=Math.PI/2;
            for(let i=0;i<8;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.28,.045,4,12),this.rope);ring.rotation.y=Math.PI/2;ring.position.set(-5.12+i*.09,.72,-.5);snare.add(ring);}
          }
        }
        for(const x of [-3.8,3.8]){
          if(theme==='purify'){
            this.cylinder(payload,.36,.24,.3,x,.3,.7,this.iron);for(const s of [-1,1])this.box(payload,.09,.4,.09,x+s*.22,.16,.7,this.iron);
            this.tag(payload,x,.36,.96,.24);
          }else{
            this.box(payload,.8,.32,.54,x,.18,.7,this.wood);
            for(const offset of [-.28,.28])this.box(payload,.06,.36,.59,x+offset,.2,.7,this.iron);
            for(let i=0;i<3;i++){
              const roll=this.cylinder(payload,.065,.065,.62,x,.46,.51+i*.17,theme==='wire'?this.paper:this.iron);roll.rotation.z=Math.PI/2;
              this.tag(payload,x-.08,.43,.54+i*.17,.12);
            }
            this.cord(payload,[new THREE.Vector3(x,.43,.7),new THREE.Vector3(x-.4,.25,.45),new THREE.Vector3(x-.6,.06,0)],.018,this.rope);
          }
        }
        this.merge(snare);this.merge(payload);
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,0);
    this.sparks=new THREE.Points(geometry,new THREE.PointsMaterial({color:0xffb76c,size:.075,transparent:true,opacity:.9,depthWrite:false}));this.sparks.frustumCulled=false;this.root.add(this.sparks);
  }
  private box(root:THREE.Group,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);root.add(mesh);return mesh;}
  private cylinder(root:THREE.Group,r1:number,r2:number,h:number,x:number,y:number,z:number,m:THREE.Material){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,10),m);mesh.position.set(x,y,z);root.add(mesh);return mesh;}
  private tag(root:THREE.Group,x:number,y:number,z:number,width:number){const tag=new THREE.Mesh(new THREE.PlaneGeometry(width,width*2),this.paper);tag.position.set(x,y,z);tag.rotation.x=-.13;tag.rotation.z=.07;root.add(tag);}
  private cord(root:THREE.Group,points:THREE.Vector3[],r:number,m:THREE.Material){root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),12,r,4,false),m));}
  private merge(root:THREE.Group){
    root.updateMatrixWorld(true);const by=new Map<THREE.Material,THREE.BufferGeometry[]>();
    for(const node of [...root.children])if(node instanceof THREE.Mesh){node.updateMatrix();const list=by.get(node.material)??[];list.push(node.geometry.applyMatrix4(node.matrix));by.set(node.material,list);root.remove(node);}
    for(const [material,parts] of by){const geometry=mergeGeometries(parts)!;parts.forEach(g=>g.dispose());const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;root.add(mesh);}
  }
  update(v:VillageView,now:number){
    const theme=v.chapter?.trap??'wire';for(const [key,group] of this.styles)group.visible=key===theme;
    this.snares.forEach(g=>g.visible=v.upgrades.traps>0);this.payloads.forEach(g=>g.visible=v.upgrades.charges>0);
    let n=0;for(const site of v.traps??[]){
      const bursting=site.burstUntil>now,charging=site.burstAt>now;if(!bursting&&!charging)continue;
      const t=bursting?1-(site.burstUntil-now)/.45:1-(site.burstAt-now)/.8;
      for(let i=0;i<24;i++){
        const a=i*2.39996,r=bursting?t*(1+(i%5)*.65):.22;
        this.positions.set([site.x+(charging?(i%2?-3.8:3.8):Math.cos(a)*r),.4+(bursting?Math.sin(t*Math.PI)*(.4+(i%4)*.4):i%3*.09),site.z+(charging?.7:Math.sin(a)*r)],n);n+=3;
      }
    }
    (this.sparks.material as THREE.PointsMaterial).color.setHex(TRAP_THEMES[theme].color);this.sparks.geometry.setDrawRange(0,n/3);if(n)this.sparks.geometry.attributes.position.needsUpdate=true;
  }
}
