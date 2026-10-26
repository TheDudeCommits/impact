import * as THREE from 'three';
import {RIFT_STRUCTURE_HEIGHT} from './RiftStructures';
import {riftStructures} from '../../game/moba/map';
import {StageKit,type Placement} from '../stages/StageKit';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {lookStageMaterial} from '../look/stageMaterials';
import {addShaderPatch} from '../look/shaderPatch';
import {PaintedSky} from '../stages/PaintedSky';
import {StageAmbient} from '../stages/ambient';
import {stageMaterial,wearGround,leafGreen} from '../stages/build';
import {RIFT_BASES,RIFT_BOUNDS,RIFT_PATHS,RIFT_LANE_WIDTH,RIFT_CAMPS,RIFT_BOSS,RIFT_SOLIDS,RIFT_GROVES,RIFT_GATES,RIFT_OUTPOSTS,RIFT_RIDGES} from '../../game/moba/map';
import {RIFT_STAGE} from '../../game/moba/model';
import {laneRibbon,pointNearPath,RIFT_INK} from './palette';

export class RiftWarWorld {
  readonly root=new THREE.Group();
  readonly occluders:THREE.Object3D[]=[];
  private kit=new StageKit(this.root,RIFT_STAGE);
  private sky?:PaintedSky;
  private readonly ambient=new StageAmbient('Rift valley');
  private water?:THREE.MeshStandardMaterial;
  private paving?:THREE.Texture;
  private time={value:0};
  constructor(){this.root.name='Rift War · Valley of the End';this.root.add(this.ambient.root);}
  async load(){
    this.kit.grade=(material,piece)=>{
      if(piece==='asian/sakura'&&/Sakura/.test(material.name))leafGreen(material,[0x172d15,0x88ac4d]);
      if(/Roof/.test(material.name))material.color.multiply(new THREE.Color(0x829da7));
      if(piece.startsWith('br/rock')||piece.endsWith('valley-escarpment.glb')){material.emissive.setHex(0xa3ada0);material.emissiveMap=material.map;material.emissiveIntensity=.28;}
    };
    await Promise.all([this.ground(),this.kit.load(['asian/pagoda','asian/torii','asian/building-grand','asian/wall-tall','asian/lantern','asian/bush','asian/sakura','asian/ivy','asian/building-courtyard','br/rock-c','br/rock-b','br/rock-d','br/grass','br/reeds','br/stone-lamp','/assets/moba/structures/valley-escarpment.glb']),this.loadSky(),this.monument()]);
    this.landscape();this.interior();this.baseTerraces();this.atmosphere();this.kit.flush(RIFT_STAGE,32);this.cameraBounds();
    this.root.updateMatrixWorld(true);
  }
  update(time:number){this.time.value=time;this.sky?.update(time);this.ambient.update(time);if(this.water?.map)this.water.map.offset.y=time*.004;}
  dispose(){
    (this.sky?.mesh.material.uniforms.uMap.value as THREE.Texture|undefined)?.dispose();this.sky=undefined;
    this.ambient.dispose();this.kit.dispose();
  }
  private async loadSky(){this.sky=await PaintedSky.load('/assets/environment/sky/leaf-dusk.webp',{rotation:.45,drift:.00025,exposure:.8,tint:0xfff8ed});this.root.add(this.sky.mesh);}
  private async ground(){
    const paving=await new THREE.TextureLoader().loadAsync('/assets/environment/paving/pavement_01_diff_2k.jpg');
    this.paving=paving;paving.colorSpace=THREE.SRGBColorSpace;paving.wrapS=paving.wrapT=THREE.RepeatWrapping;paving.anisotropy=4;
    const moss=await new THREE.TextureLoader().loadAsync('/assets/environment/rift-war/forest-floor.webp');moss.colorSpace=THREE.SRGBColorSpace;moss.wrapS=moss.wrapT=THREE.RepeatWrapping;moss.repeat.set(32,32);moss.anisotropy=4;
    const floor=stageMaterial(RIFT_STAGE,'Rift moss and earth',{map:moss,color:0xb5c6af,roughness:1});
    wearGround(floor,{key:'rift-earth',scale:1.8,light:[.55,1.16],patch:0x223c20,patchAmount:.55,damp:.15});
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(240,240).rotateX(-Math.PI/2),floor);plane.position.y=-.055;plane.receiveShadow=true;this.root.add(plane);
    const edge=stageMaterial(RIFT_STAGE,'Inkstone lane edge',{color:0x717762});
    const stone=stageMaterial(RIFT_STAGE,'Worn avenue paving',{map:paving,color:0xbdb5ab,roughness:.95});
    wearGround(stone,{key:'rift-stone',scale:.8,light:[.85,1.06],patch:0x524f40,patchAmount:.14,damp:.15});
    for(const points of Object.values(RIFT_PATHS)){
      for(const [width,y,material] of [[RIFT_LANE_WIDTH+.25,-.025,edge],[RIFT_LANE_WIDTH,.008,stone]] as const){const m=new THREE.Mesh(laneRibbon(points,width,y),material);m.receiveShadow=true;this.root.add(m);}
      for(const p of points.slice(1,-1)){
        const g=new THREE.CircleGeometry(RIFT_LANE_WIDTH/2,12).rotateX(-Math.PI/2);g.translate(p.x,.012,p.z);
        const uv=g.getAttribute('uv'),pos=g.getAttribute('position');for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)/5,pos.getZ(i)/5);
        const m=new THREE.Mesh(g,stone);m.receiveShadow=true;this.root.add(m);
      }
    }
    this.water=stageMaterial(RIFT_STAGE,'River shallows',{color:0x427e79,roughness:.34,metalness:.08});
    addShaderPatch(this.water,'rift-river-flow',shader=>{
      shader.uniforms.uRiftRiverTime=this.time;shader.vertexShader='varying vec2 vRiftRiver;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRiftRiver = position.xz;');
      shader.fragmentShader='uniform float uRiftRiverTime; varying vec2 vRiftRiver;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        vec2 p = vRiftRiver;
        float stream = (p.x+p.y)*.7-uRiftRiverTime*.9;
        float ripple = sin(stream+sin((p.x-p.y)*1.4+stream*.23)*1.9);
        float fine = sin(stream*5.1+sin(p.x*2.7-p.y*1.5)*2.);
        float glint = smoothstep(.85,1.,ripple)*smoothstep(.35,1.,fine);
        float bank = smoothstep(2.3,3.2,abs(p.x-p.y)*.7071);
        diffuseColor.rgb *= .72 + ripple*.08 + fine*.025;
        diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.34,.57,.46),bank*.42);
        diffuseColor.rgb += vec3(.23,.31,.28)*glint;`);
    });
    const river=new THREE.Mesh(laneRibbon([{x:-89,z:-89},{x:89,z:89}],9,-.015),this.water);river.receiveShadow=true;this.root.add(river);
    const trail=stageMaterial(RIFT_STAGE,'Jungle footpath',{color:0x7f8264,roughness:1});
    for(const camp of [...RIFT_CAMPS,RIFT_BOSS]){
      const end={x:(camp.x-camp.z)/2,z:(camp.z-camp.x)/2};
      const m=new THREE.Mesh(laneRibbon([camp,end],3,-.028),trail);m.receiveShadow=true;this.root.add(m);
      const ring=new THREE.Mesh(new THREE.RingGeometry(camp===RIFT_BOSS?5:2.6,camp===RIFT_BOSS?5.4:2.9,32).rotateX(-Math.PI/2),edge);ring.position.set(camp.x,.022,camp.z);this.root.add(ring);
    }
  }
  private landscape(){
    for(const side of [-1,1])for(let i=0;i<9;i++){
      const along=-86+i*22,offset=92+(i%3)*7;
      this.place('asian/sakura',{x:side*offset,z:along,width:13+(i%3)*2,height:17+(i%2)*4,rot:i*.8,shadow:false});
      this.place('asian/sakura',{x:along,z:side*(offset+5),width:16,height:20,rot:i*.7,shadow:false});
    }
    for(const side of [-1,1]){
      for(let i=0;i<8;i++){
        if(i%3===1)continue;
        this.place('asian/wall-tall',{x:side*89,z:-72+i*21,width:22,height:3.2,rot:Math.PI/2,shadow:false});
        this.place('asian/wall-tall',{x:-72+i*21,z:side*89,width:22,height:3.2,shadow:false});
      }
      this.place('asian/pagoda',{x:side*92,z:-side*91,width:22,height:40,rot:side*.4,shadow:false});
      this.place('asian/building-grand',{x:side*73,z:-side*100,width:29,height:22,rot:side*Math.PI/4,shadow:false});
      this.place('asian/torii',{x:side*91,z:side*69,width:17,height:16,rot:Math.PI/2,shadow:false});
      this.place('asian/pagoda',{x:side*110,z:side*78,width:18,height:30,shadow:false});
    }
    for(let x=-48;x<=48;x+=12)for(let z=-48;z<=48;z+=12){
      if(Math.abs(x-z)<13||Object.values(RIFT_PATHS).some(p=>pointNearPath(x,z,p,10))||[...RIFT_CAMPS,RIFT_BOSS].some(p=>Math.hypot(x-p.x,z-p.z)<9))continue;
      this.place('asian/bush',{x:x+Math.sin(z)*2,z,width:3.5,height:.5,rot:x*.3+z*.2,shadow:false});
    }
  }
  private interior(){
    for(const [i,b] of RIFT_RIDGES.entries()){
      const long=Math.max(b.halfX,b.halfZ),alongX=b.halfX>b.halfZ;
      const count=Math.max(1,Math.ceil(long/3));
      for(let j=0;j<count;j++){
        const offset=(j+.5)/count*long*2-long;
        const x=b.x+(alongX?offset:0),z=b.z+(alongX?0:offset);
        this.place('/assets/moba/structures/valley-escarpment.glb',{x,z,y:-.5,width:7.4,height:10.3+(i+j)%3*.25,rot:(alongX?0:Math.PI/2)+(j%2)*Math.PI,tint:0xc9cfbc,shadow:false});
        if((i+j)%4===0)this.place('asian/sakura',{x,z,y:7,width:12,height:14,rot:i*.4,shadow:false});
        if((i+j)%3===0)this.place('asian/bush',{x,z,y:8.8,width:7,height:2,shadow:false});
      }
    }
    for(const [i,g] of RIFT_GROVES.entries()){
      this.place('br/rock-b',{x:g.x-1,z:g.z+.8,y:-.25,width:8.2,height:4.9,rot:i*.93,tint:0x969b82,shadow:true});
      this.place('br/rock-c',{x:g.x+2,z:g.z-1.8,y:-.35,width:5.5,height:4.4,rot:i*.61,tint:0x9aa08a,shadow:true});
      this.place('asian/sakura',{x:g.x,z:g.z,y:-.8,width:17+(i%3),height:21+(i%3),rot:i*.83,shadow:false});
      this.place('asian/bush',{x:g.x-2,z:g.z+2,y:2.7,width:7,height:1.9,rot:i,shadow:false});
      for(const [dx,dy,dz,w] of [[-3,13,1,4.8],[2,15,-1,5.2],[4,11,2,4.3],[-1,10,-4,4.6]])this.place('asian/bush',{x:g.x+dx,z:g.z+dz,y:dy,width:w,height:3.3,rot:i*.8+dx,shadow:false});
      this.place('asian/ivy',{x:g.x,z:g.z+3.7,y:.7,width:6,height:3.3,rot:0,shadow:false});
      for(const side of [-1,1])this.place('br/grass',{x:g.x+side*4.4,z:g.z-side*2,width:2.5,height:.6,rot:i+side,shadow:false});
    }
    for(const [i,b] of RIFT_OUTPOSTS.entries()){
      this.place(i%2?'asian/building-grand':'asian/building-courtyard',{x:b.x,z:b.z,width:11,height:7.5,rot:0,shadow:true});
      this.place('asian/lantern',{x:b.x+4.2,z:b.z+4.4,width:.8,height:2.3,shadow:false});
    }
    for(const g of RIFT_GATES)this.place('asian/torii',{x:g.x,z:g.z,width:13.6,height:8.4,rot:Math.PI*.75,shadow:true});
    for(let n=-70;n<=70;n+=8)for(const side of [-1,1]){
      const x=n+side*4.7,z=n-side*4.7;
      if(Object.values(RIFT_PATHS).some(p=>pointNearPath(x,z,p,8)))continue;
      this.place('br/reeds',{x,z,width:2.8,height:1.2,rot:n*.24,shadow:false});
      this.place('br/rock-d',{x:x+side,z:z-side,width:2.4,height:.32,rot:n*.6,shadow:false});
    }
    for(const points of Object.values(RIFT_PATHS))for(let i=1;i<points.length-1;i++){
      const p=points[i],a=points[i-1],b=points[i+1],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
      for(const side of [-1,1])this.place('br/stone-lamp',{x:p.x-dz/len*6.1*side,z:p.z+dx/len*6.1*side,width:.6,height:1.65,shadow:false});
    }
    for(const camp of [...RIFT_CAMPS,RIFT_BOSS])for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      this.place('br/rock-d',{x:camp.x+Math.cos(a)*(camp===RIFT_BOSS?7:4.5),z:camp.z+Math.sin(a)*(camp===RIFT_BOSS?7:4.5),width:1.4,height:.2,rot:a,shadow:false});
    }
  }
  private baseTerraces(){
    for(const team of ['heroes','villains'] as const){
      const b=RIFT_BASES[team],color=RIFT_INK[team];
      const floor=stageMaterial(RIFT_STAGE,`${team} sanctuary stone`,{color:team==='heroes'?0xb8b1a1:0x827986,roughness:.9});
      floor.map=this.paving??null;const disc=new THREE.Mesh(new THREE.CylinderGeometry(14,14,.09,48),floor);const pos=disc.geometry.getAttribute('position'),uv=disc.geometry.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setXY(i,pos.getX(i)/5,pos.getZ(i)/5);disc.position.set(b.x,-.03,b.z);disc.receiveShadow=true;this.root.add(disc);
      const rune=new THREE.Mesh(new THREE.RingGeometry(12.9,13.15,64).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.72,depthWrite:false}));rune.position.set(b.x,.027,b.z);this.root.add(rune);
      const sign=team==='heroes'?1:-1;
      for(const [dx,dz] of [[-9,4],[-4,9],[7,9],[-9,-7]])this.place('asian/lantern',{x:b.x+dx*sign,z:b.z+dz*sign,width:.65,height:2.2,shadow:false});
      this.place('asian/torii',{x:b.x-sign*6,z:b.z+sign*11,width:12,height:8,rot:-Math.PI/4,shadow:false});
    }
  }
  private atmosphere(){
    const foam:{x:number;z:number;radius:number}[]=[];
    for(let n=-75;n<=75;n+=6)for(const side of [-1,1]){
      const x=n+side*2.45,z=n-side*2.45;
      if(Object.values(RIFT_PATHS).some(p=>pointNearPath(x,z,p,6)))continue;
      foam.push({x,z,radius:.85+(Math.abs(n)%3)*.13});
    }
    this.ambient.foam({spots:foam,y:.004,color:0xcae2d4,opacity:.45});
    this.ambient.birds({centre:[0,0,-30],count:12,radius:66,height:35,spread:12,speed:9,size:.45,color:0x282731,seed:73});
    this.ambient.motes({min:[-65,1,-65],max:[65,14,65],count:90,velocity:[.65,-.25,.4],size:.09,color:0xb3b665,color2:0x738547,opacity:.7,wobble:1,seed:81});
  }
  private place(piece:string,at:Placement){
    if(at.height!==undefined&&at.width!==undefined){const size=this.kit.size(piece),scale=at.width/size.x;this.kit.place(piece,{...at,sy:at.height/(size.y*scale)});}
    else this.kit.place(piece,at);
  }
  private async monument(){
    const source=await new GLTFLoader().loadAsync('/assets/stages/valley-of-the-end.glb');source.scene.updateMatrixWorld(true);
    const group=new THREE.Group(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    source.scene.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;const src=Array.isArray(o.material)?o.material[0]:o.material;
      if(/Material\.(010|016|023|025)$/.test(src.name))return;
      if(src.name==='Material.001'){
        const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);
        geometry.scale(5,1.5,1.05);geometry.translate(0,-2,-30);
        const material=lookStageMaterial(src,RIFT_STAGE,o.name,{baked:.65});materials.add(material);
        for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);
        const cliff=new THREE.Mesh(geometry,material);cliff.name='Valley canyon walls';this.root.add(cliff);return;
      }
      const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld),material=lookStageMaterial(src,RIFT_STAGE,o.name,{baked:.65});materials.add(material);
      for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);
      const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=false;mesh.receiveShadow=false;group.add(mesh);
    });
    const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3()),scale=58/size.y;
    group.scale.setScalar(scale);group.position.set(-(bounds.min.x+bounds.max.x)/2*scale,-bounds.min.y*scale,-94-bounds.max.z*scale);group.name='First Hokage and Madara · distant monument';this.root.add(group);
    source.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(!materials.has(m)){for(const value of Object.values(m))if(value instanceof THREE.Texture&&!textures.has(value))value.dispose();m.dispose();}});
  }
  private cameraBounds(){
    const material=new THREE.MeshBasicMaterial({visible:false});
    for(const p of RIFT_SOLIDS){const structure=riftStructures().find(s=>s.id===p.id),height=structure?RIFT_STRUCTURE_HEIGHT[structure.kind]:p.halfY*2;const mesh=new THREE.Mesh(new THREE.BoxGeometry(p.halfX*2,height,p.halfZ*2),material);mesh.position.set(p.x,height/2,p.z);mesh.visible=false;this.root.add(mesh);this.occluders.push(mesh);}
    for(const side of [-1,1])for(const axis of ['x','z'] as const){
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(axis==='x'?1:168,14,axis==='z'?1:168),material);mesh.position.set(axis==='x'?side*RIFT_BOUNDS.halfX:0,7,axis==='z'?side*RIFT_BOUNDS.halfZ:0);mesh.visible=false;this.root.add(mesh);this.occluders.push(mesh);
    }
  }
}
