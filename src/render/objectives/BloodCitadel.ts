import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {stageColliders} from '../../game/environmentLayout';
import {ObjectiveScenery} from './ObjectiveScenery';
import {installCameraCutaway} from '../CameraCutaway';
import {ObjectiveAmbience, weatherStone} from './ObjectiveAmbience';

export class BloodCitadel {
  readonly root=new THREE.Group();readonly occluders:THREE.Object3D[]=[];
  private ambience=new ObjectiveAmbience('blood');
  constructor(){this.root.name='Bad Blood · The Fallen Citadel';}
  async load(){
    const kit=new ObjectiveScenery(this.root,'blood-citadel');
    await Promise.all([kit.load(['citadel-keep','pagoda','wall-tall','torii','building-courtyard','lantern','sakura','harbor/rocks-a','ivy']),this.ground(),this.sky(),this.ambience.load()]);
    kit.place('citadel-keep',97,0,72,-Math.PI/2,-17,62);
    kit.place('citadel-keep',-113,8,68,Math.PI/2,-10,64);
    for(const side of [-1,1]){
      kit.place('torii',side*36,0,22,Math.PI/2,0,16,3);
      kit.place('pagoda',side*46,-34,19,side*.18,0,28);
      kit.place('pagoda',side*44,39,16,Math.PI+side*.2,0,25);
      for(let i=0;i<7;i++){
        kit.place('wall-tall',side*39,-22+i*8,8,Math.PI/2,0,5+(i%2)*2,3);
      }
      for(let i=0;i<5;i++){
        kit.place('building-courtyard',side*(-55+i*25),side*64,24,side<0?0:Math.PI,0,16+i%2*4);
      }
      for(const z of [-19,19])kit.place('lantern',side*32,z,1.3,0,.8,3);
      kit.place('sakura',side*44,side*-43,22,side*.4,0,21);
    }
    kit.place('torii',0,-45,23,0,-1,19,4);
    kit.place('torii',0,44,21,0,-1,15,4);
    kit.place('pagoda',-16,-80,33,.2,6,51);
    kit.place('pagoda',28,91,28,-.2,9,48);
    for(const side of [-1,1])for(let i=0;i<14;i++){
      kit.place('harbor/rocks-a',side*(34+i%3*2.5),-26+i*4,3+i%3,i*.67,-.35,1+i%4*.7);
      if(i%3===0)kit.place('ivy',side*38,-24+i*4,5,side*Math.PI/2,2.5,5);
    }
    kit.flush();this.root.add(this.ambience.root);await this.boundary();
    this.root.traverse(object=>{if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])if(material instanceof THREE.MeshStandardMaterial)installCameraCutaway(material);});
    this.root.updateMatrixWorld(true);
  }
  update(time:number){this.ambience.update(time);}
  dispose(){this.ambience.dispose();}
  private async sky(){
    const map=await new THREE.TextureLoader().loadAsync('/assets/environment/sky/citadel-moon.webp');map.colorSpace=THREE.SRGBColorSpace;
    const sky=new THREE.Mesh(new THREE.SphereGeometry(450,48,24),new THREE.MeshBasicMaterial({map,side:THREE.BackSide,fog:false,toneMapped:false}));
    sky.name='Citadel moon';sky.rotation.set(0,-.8,-.62);sky.renderOrder=999_999;sky.frustumCulled=false;this.root.add(sky);
  }
  private async ground(){
    const loader=new THREE.TextureLoader(),maps=await Promise.all(['diff','nor_gl','rough'].map(k=>loader.loadAsync(`/assets/environment/paving/pavement_01_${k}_2k.jpg`)));
    maps.forEach(t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(8,7);t.anisotropy=8;});maps[0].colorSpace=THREE.SRGBColorSpace;
    const stone=new THREE.MeshPhysicalMaterial({map:maps[0],normalMap:maps[1],roughnessMap:maps[2],normalScale:new THREE.Vector2(.6,.6),color:0x778b9d,roughness:.7,clearcoat:.28,clearcoatRoughness:.35});
    weatherStone(stone,true);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(68,57),stone);floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.receiveShadow=true;this.root.add(floor);
    const surrounding=new THREE.Mesh(new THREE.PlaneGeometry(360,360),new THREE.MeshStandardMaterial({color:0x293b4b,roughness:.96}));surrounding.rotation.x=-Math.PI/2;surrounding.position.y=-1.3;surrounding.receiveShadow=true;this.root.add(surrounding);
    const crest=await loader.loadAsync('/assets/environment/objectives/citadel-medallion.webp');crest.colorSpace=THREE.SRGBColorSpace;crest.anisotropy=8;
    const carving=new THREE.Mesh(new THREE.PlaneGeometry(28,28),new THREE.MeshStandardMaterial({map:crest,bumpMap:crest,bumpScale:.055,alphaTest:.25,roughness:.82,color:0xabb6c6,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
    carving.name='Weathered citadel medallion';carving.rotation.x=-Math.PI/2;carving.position.y=-.02;carving.receiveShadow=true;this.root.add(carving);
    const gold=new THREE.MeshStandardMaterial({color:0x7c7662,roughness:.7,metalness:.2});
    const strips:THREE.BufferGeometry[]=[];
    for(const x of [-28,28])strips.push(new THREE.BoxGeometry(.18,.02,47).translate(x,0,0));
    for(const z of [-22,22])strips.push(new THREE.BoxGeometry(56,.02,.18).translate(0,0,z));
    this.root.add(new THREE.Mesh(mergeGeometries(strips)!,gold));strips.forEach(g=>g.dispose());
  }
  private async boundary(){
    const stone=new THREE.MeshStandardMaterial({color:0x9ca8ae,roughness:.89}),iron=new THREE.MeshStandardMaterial({color:0x273441,roughness:.75,metalness:.4});
    installCameraCutaway(stone);
    const map=await new THREE.TextureLoader().loadAsync('/assets/environment/paving/pavement_01_diff_2k.jpg');map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(3,2);map.anisotropy=4;stone.map=map;
    const pieces:THREE.BufferGeometry[]=[],fires=[];
    for(const side of [-1,1]){
      pieces.push(new THREE.BoxGeometry(1.5,1.7,50).translate(side*31,0,0));
      pieces.push(new THREE.BoxGeometry(61,1.7,1.5).translate(0,0,side*25));
      for(let i=0;i<7;i++){
        const z=-23+i*7.6;pieces.push(new THREE.BoxGeometry(1.8,2.3,1.8).translate(side*31,.5,z));
        pieces.push(new THREE.BoxGeometry(2.15,.25,2.15).translate(side*31,1.75,z));
      }
      for(const [x,z,h] of [[-23,-29,9],[-10,29,6],[14,-29,11],[24,29,7]]){
        const column=new THREE.CylinderGeometry(1,1.5,h,9);const vertices=column.attributes.position;for(let i=0;i<vertices.count;i++)if(vertices.getY(i)>h*.45){const rough=Math.sin(vertices.getX(i)*4+vertices.getZ(i)*7)*.5;vertices.setY(i,vertices.getY(i)+rough);}column.computeVertexNormals();column.translate(x*side,h/2,z*side);pieces.push(column);
        const fallen=new THREE.CylinderGeometry(.9,1.1,4,9);fallen.rotateZ(1.3);fallen.rotateY(x*.3);fallen.translate(x*side+3,1,z*side+3);pieces.push(fallen);
        pieces.push(new THREE.BoxGeometry(3.6,.5,3.6).translate(x*side,.25,z*side));
      }
      for(const z of [-16,16]){
        const torch=new THREE.Mesh(new THREE.CylinderGeometry(.45,.26,3.7,7),iron);torch.position.set(side*31,1.7,z);this.root.add(torch);
        const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.8,.36,.45,8),iron);bowl.position.set(side*31,3.6,z);this.root.add(bowl);
        fires.push({x:side*31,y:3.8,z,size:.85,smoke:.2,seed:z+side*2});
        const pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,11,6),iron);pole.position.set(side*32,5.5,z+3);this.root.add(pole);
        this.ambience.cloth(side*32,7.5,z+3,2.2,5.8,side*Math.PI/2);
      }
      const light=new THREE.PointLight(0xffb374,8,13,2);light.position.set(side*30,4,side*16);this.root.add(light);
    }
    this.ambience.fire(fires);
    const triangles=pieces.map(g=>g.toNonIndexed());const masonry=new THREE.Mesh(mergeGeometries(triangles)!,stone);[...pieces,...triangles].forEach(g=>g.dispose());masonry.receiveShadow=true;masonry.castShadow=true;this.root.add(masonry);
    const invisible=new THREE.MeshBasicMaterial({visible:false});
    for(const c of stageColliders('blood-citadel').walls){const proxy=new THREE.Mesh(new THREE.BoxGeometry(c.halfX*2,c.halfY*2,c.halfZ*2),invisible);proxy.position.set(c.x,c.y,c.z);proxy.visible=false;this.root.add(proxy);this.occluders.push(proxy);}
  }
}
