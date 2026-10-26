import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {stageColliders} from '../../game/environmentLayout';
import {installCameraCutaway} from '../CameraCutaway';
import {lookStageMaterial} from '../look/stageMaterials';
import {ObjectiveScenery} from './ObjectiveScenery';
import {ObjectiveAmbience, weatherStone} from './ObjectiveAmbience';

export class HiddenLeafVillage {
  readonly root=new THREE.Group();
  readonly occluders:THREE.Object3D[]=[];
  private ambience=new ObjectiveAmbience('leaf');
  constructor(){this.root.name='Hidden Leaf · Gate District';}

  async load(){
    const kit=new ObjectiveScenery(this.root,'hidden-leaf');
    await Promise.all([
      kit.load(['building-grand','building-shop','building-courtyard','dojo','pagoda','torii','wall-tall','lantern','sakura','garden-tree','bush','harbor/crate','harbor/barrel','harbor/rocks-a']),
      this.ground(),this.hokageCliff(),this.sky(),this.ambience.load(),
    ]);
    for(const side of [-1,1])for(let i=0;i<4;i++)kit.place('wall-tall',side*(12+i*8),20,8.2,0,0,8,2);
    for(const side of [-1,1]){
      kit.place('pagoda',side*47,24,15,side*.15,0,26);
      for(let row=0;row<5;row++){
        const z=-37+row*19;
        kit.place(row%2?'building-courtyard':'building-shop',side*(50+row%2*2),z,19,side===1?-Math.PI/2:Math.PI/2,0,12+row%3*2);
        kit.place('lantern',side*40.8,z+6,1.25,0,0,3.2);
        kit.place('bush',side*42,z-5,4,0,0,2);
      }
      for(let i=0;i<4;i++)kit.place('sakura',side*(62+i%2*9),-42+i*31,15,side*i*.4,0,20);
      kit.place('dojo',side*32,62,27,0,0,15);
      kit.place('pagoda',side*58,82,21,side*.15,0,37);
      kit.place('wall-tall',side*15,-46,12,0,0,9,2);
      kit.place('wall-tall',side*37,-46,8,0,0,9,2);
      kit.place('torii',side*27,-46,12,0,0,10,2);
      kit.place('building-grand',side*37,-66,26,Math.PI,0,19);
      for(let i=0;i<4;i++)kit.place('building-courtyard',side*(62+i%2*12),-80+i*44,25,side*Math.PI/2,0,20+i%2*7);
      for(let i=0;i<9;i++)kit.place('wall-tall',side*81,-92+i*26,27,Math.PI/2,0,14,3);
      kit.place('sakura',side*18,49,14,side,0,18);
      for(let i=0;i<8;i++)kit.place('harbor/rocks-a',side*(44+i%2*2),-42+i*12,3.5,i,0,1.6);
    }
    kit.place('torii',0,-46,23,0,0,14,4);
    for(let i=0;i<27;i++)kit.place('garden-tree',(i%9-4)*19,-88-Math.floor(i/9)*18,22+(i%3)*3,i*.7,0,23+(i%4)*4);
    kit.place('building-shop',-11,33,12,0,0,7.5,8);
    for(let i=0;i<4;i++)kit.place('harbor/crate',-15+i*1.1,30,1.05,i*.12);
    for(const x of [-15,-13.6])kit.place('harbor/barrel',x,31,1.1,0,0,1.5);
    for(const [x,z] of [[-7,22],[7,22],[-18,33],[14,43],[-41,13],[41,13]])kit.place('lantern',x,z,1.2,0,0,3.4);
    for(const side of [-1,1])for(let i=0;i<7;i++){
      kit.place('harbor/crate',side*(41.5+i%2*1.7),-31+i*10,1.1+i%3*.25,i*.42,0,.9+i%3*.3);
      if(i%2)kit.place('harbor/barrel',side*43,-29+i*10,.9,0,0,1.3);
    }
    kit.flush();this.root.add(this.ambience.root);
    this.details(kit);this.cameraWalls();this.batchDetails();
    this.root.traverse(object=>{if(object instanceof THREE.Mesh)for(const material of Array.isArray(object.material)?object.material:[object.material])if(material instanceof THREE.MeshStandardMaterial)installCameraCutaway(material);});
    this.root.updateMatrixWorld(true);
  }
  update(time:number){this.ambience.update(time);}
  dispose(){this.ambience.dispose();}

  private async ground(){
    const loader=new THREE.TextureLoader();
    const paths=['diff','nor_gl','rough'];
    const maps=await Promise.all(paths.map(k=>loader.loadAsync(`/assets/environment/paving/pavement_01_${k}_2k.jpg`)));
    for(const t of maps){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(30,34);t.anisotropy=8;}
    maps[0].colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshStandardMaterial({map:maps[0],normalMap:maps[1],roughnessMap:maps[2],color:0xe0e2e6,roughness:.78,normalScale:new THREE.Vector2(.42,.42)});
    material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float stoneValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(stoneValue*.92,stoneValue,stoneValue*1.12),.65);`);};
    material.customProgramCacheKey=()=> 'leaf-grey-stone-v1';
    weatherStone(material,false);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,300),material);floor.rotation.x=-Math.PI/2;floor.position.set(0,-.025,14);floor.receiveShadow=true;this.root.add(floor);
    const dark=new THREE.MeshStandardMaterial({color:0x4b5051,roughness:.95});
    for(const x of [-39,-9,9,39])this.box(x,.015,-7,x===-9||x===9?.28:.65,.035,72,dark);
    for(const z of [-42,17,42])this.box(0,.016,z,79,.035,.3,dark);
  }

  private async sky(){
    const texture=await new THREE.TextureLoader().loadAsync('/assets/environment/sky/leaf-dusk.webp');texture.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(460,48,24),new THREE.MeshBasicMaterial({map:texture,side:THREE.BackSide,fog:false,toneMapped:false}));
    mesh.name='Painted dusk';mesh.rotation.y=1.3;mesh.renderOrder=999_999;mesh.frustumCulled=false;this.root.add(mesh);
  }

  private async hokageCliff(){
    const source=await new GLTFLoader().loadAsync('/assets/stages/chunin-final.glb');
    const names=new Set(['mesh_16_389_mat_200_0','mesh_16_390_mat_122_0','mesh_16_479_mat_122_0','mesh_28_534_mat_122_0']);
    source.scene.updateMatrixWorld(true);
    const backdrop=new THREE.Group();backdrop.name='Hokage Monument';backdrop.rotation.y=Math.PI;backdrop.scale.setScalar(.52);backdrop.position.set(0,-48,-95);
    const town=new THREE.Group();town.name='Hidden Leaf skyline';town.scale.setScalar(.45);town.position.set(0,-1,95);
    const keptMaterials=new Map<THREE.Material,THREE.Material>();
    source.scene.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;
      const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);
      geometry.computeBoundingBox();const bounds=geometry.boundingBox!;
      const cliff=names.has(o.name),building=!cliff&&bounds.min.z>=37&&bounds.max.y>28;
      if(!cliff&&!building){geometry.dispose();return;}
      const material=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{let lit=keptMaterials.get(m);if(!lit){lit=lookStageMaterial(m,'hidden-leaf',o.name,{baked:.58});keptMaterials.set(m,lit);}return lit;});
      const mesh=new THREE.Mesh(geometry,material.length===1?material[0]:material);(cliff?backdrop:town).add(mesh);
    });
    const keptTextures=new Set([...keptMaterials.values()].flatMap(m=>Object.values(m).filter((v):v is THREE.Texture=>v instanceof THREE.Texture)));
    source.scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(!keptMaterials.has(m)){for(const v of Object.values(m))if(v instanceof THREE.Texture&&!keptTextures.has(v))v.dispose();m.dispose();}});
    this.root.add(backdrop,town);
  }

  private box(x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.receiveShadow=true;this.root.add(mesh);return mesh;
  }
  private details(kit:ObjectiveScenery){
    const wood=kit.material('wall-tall',/Wood 1/);
    const brass=new THREE.MeshStandardMaterial({color:0x9b7950,roughness:.55,metalness:.3});
    const glow=new THREE.MeshStandardMaterial({color:0xffce88,emissive:0xff9741,emissiveIntensity:1.2,roughness:1});
    const iron=new THREE.MeshStandardMaterial({color:0x242a2e,roughness:.7,metalness:.35});
    for(const side of [-1,1]){
      this.box(side*8.7,6,20,1.4,12,3,wood);
      for(const y of [1,5,10])this.box(side*8.7,y,20,1.48,.3,3.08,iron);
      for(const y of [2.5,6]){const brace=this.box(side*6.9,y+4,20,.45,4.5,1.5,wood);brace.rotation.z=side*.5;}
    }
    this.box(0,12.2,20,19,2,3.4,wood);
    const roof=new THREE.PlaneGeometry(23,6.5,46,12);roof.rotateX(-Math.PI/2);
    const positions=roof.attributes.position;for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i);positions.setY(i,13.7-Math.abs(z)*.34+x*x*.008);}
    roof.computeVertexNormals();const canopy=new THREE.Mesh(roof,kit.material('wall-tall',/Roof/));canopy.position.z=20;canopy.material.side=THREE.DoubleSide;canopy.receiveShadow=canopy.castShadow=true;this.root.add(canopy);
    for(const side of [-1,1]){
      this.box(side*11,3.8,21.15,5.8,7.6,.24,wood);
      for(let i=0;i<8;i++)this.box(side*(8.35+i*.76),3.8,21.29,.075,7.6,.08,brass);
      this.ambience.cloth(side*8.7,7.3,18.4,1.45,5.8);
      this.ambience.cloth(side*8.7,7.3,21.6,1.45,5.8,Math.PI);
      for(const z of [-29,4]){
        this.box(side*41,5,z,.13,10,.13,iron);
        this.box(side*41,9.6,z,2.4,.1,.1,iron);
        this.ambience.cloth(side*41,7.1,z,2.2,4.8,side*Math.PI/2);
      }
      for(const z of [-24,-3,16]){
        this.box(side*41.5,2.5,z,.13,5,.13,wood);
        this.box(side*41.5,4.2,z,.7,1.1,.7,glow);
        this.box(side*41.5,4.8,z,1,.15,1,wood);
      }
    }
    this.sign('木ノ葉隠れ',0,12,18.25,6.4,1.5,'#d8bc89','#292c29');
    this.sign('忍具  •  QUARTERMASTER',-11,4.8,28.8,7.5,.95,'#2a2925','#f5d997');
    this.box(-11,.6,27,5,1.2,1.5,wood);
    for(const x of [-14,-8])this.box(x,2.1,27,.14,4.2,.14,wood);
    this.box(-11,4.05,27,6.4,.16,.18,wood);
    const awning=new THREE.Mesh(new THREE.PlaneGeometry(6.6,2.8,12,8),new THREE.MeshStandardMaterial({color:0x953a29,roughness:1,side:THREE.DoubleSide}));
    awning.rotation.x=Math.PI*.36;awning.position.set(-11,4.1,28.2);awning.receiveShadow=true;this.root.add(awning);
    for(const z of [28.3,29.5])this.box(-11,1.4,z,5.7,.15,.45,wood);
    for(let i=0;i<8;i++){
      const bundle=new THREE.Mesh(new THREE.CylinderGeometry(.16,.18,.72,7),new THREE.MeshStandardMaterial({color:i%2?0xc5ac75:0x485548,roughness:1}));
      bundle.rotation.z=Math.PI/2;bundle.rotation.y=i*.4;bundle.position.set(-13+i*.57,1.68,28.1);this.root.add(bundle);
    }
    const fires=[];
    for(const side of [-1,1]){
      this.box(side*10.7,1.4,17.1,.16,2.8,.16,iron);
      const brazier=new THREE.Mesh(new THREE.CylinderGeometry(.5,.28,.5,8),iron);brazier.position.set(side*10.7,2.8,17.1);this.root.add(brazier);
      fires.push({x:side*10.7,y:3,z:17.1,size:.65,smoke:.1,seed:side+2});
    }
    this.ambience.fire(fires);
    for(const [x,z] of [[-13,26],[7,21]]){const light=new THREE.PointLight(0xffa358,5,8,2);light.position.set(x,3,z);this.root.add(light);}
  }
  private batchDetails(){
    this.root.updateMatrixWorld(true);const groups=new Map<THREE.Material,THREE.Mesh[]>();
    for(const child of [...this.root.children])if(child instanceof THREE.Mesh&&!(child instanceof THREE.InstancedMesh)&&child.visible&&!Array.isArray(child.material)&&child.name!=='Painted dusk'){
      const group=groups.get(child.material)??[];group.push(child);groups.set(child.material,group);
    }
    for(const [material,meshes] of groups){if(meshes.length<2)continue;
      const parts=meshes.map(m=>(m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()).applyMatrix4(m.matrixWorld));
      const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());if(!geometry)continue;
      const merged=new THREE.Mesh(geometry,material);merged.name='Gate masonry and timber';merged.receiveShadow=merged.castShadow=true;this.root.add(merged);
      for(const m of meshes){m.removeFromParent();m.geometry.dispose();}
    }
  }
  private sign(text:string,x:number,y:number,z:number,w:number,h:number,bg:string,ink:string){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;const c=canvas.getContext('2d')!;
    c.fillStyle=bg;c.fillRect(0,0,1024,192);c.strokeStyle=ink;c.lineWidth=5;c.strokeRect(12,12,1000,168);c.fillStyle=ink;c.textAlign='center';c.textBaseline='middle';c.font='bold 74px serif';c.fillText(text,512,100,960);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshStandardMaterial({map:texture,roughness:.8,side:THREE.DoubleSide});installCameraCutaway(material);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);mesh.position.set(x,y,z);mesh.rotation.y=Math.PI;this.root.add(mesh);
  }
  private cameraWalls(){
    const invisible=new THREE.MeshBasicMaterial({visible:false});
    const {walls,landmarks}=stageColliders('hidden-leaf');
    for(const c of [...walls,...landmarks]){const proxy=this.box(c.x,c.y,c.z,c.halfX*2,c.halfY*2,c.halfZ*2,invisible);proxy.visible=false;if(landmarks.includes(c))proxy.name='stage-landmark-occluder';this.occluders.push(proxy);}
  }
}
