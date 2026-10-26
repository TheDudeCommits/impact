export class UnitGrid<T extends {x:number;z:number}> {
 private readonly buckets=new Map<number,T[]>();
 private readonly cells=new WeakMap<T,number>();
 private readonly order=new WeakMap<T,number>();
 private key(x:number,z:number){return (Math.floor(x/12)+1024)*2048+Math.floor(z/12)+1024;}
 rebuild(units:Iterable<T>){
  for(const bucket of this.buckets.values())bucket.length=0;
  let order=0;for(const unit of units){this.order.set(unit,order++);this.insert(unit);}
 }
 private insert(unit:T){const key=this.key(unit.x,unit.z);let bucket=this.buckets.get(key);if(!bucket)this.buckets.set(key,bucket=[]);bucket.push(unit);this.cells.set(unit,key);}
 moved(unit:T){const key=this.cells.get(unit);if(key===this.key(unit.x,unit.z))return;const previous=this.buckets.get(key!);if(previous){const index=previous.indexOf(unit);if(index>=0)previous.splice(index,1);}this.insert(unit);}
 query(x:number,z:number,radius:number,out:T[]):T[]{
  out.length=0;
  for(let cx=Math.floor((x-radius)/12);cx<=Math.floor((x+radius)/12);cx++)for(let cz=Math.floor((z-radius)/12);cz<=Math.floor((z+radius)/12);cz++){
   const bucket=this.buckets.get((cx+1024)*2048+cz+1024);if(bucket)for(const unit of bucket)out.push(unit);
  }
  return out;
 }
 before(a:T,b:T){return this.order.get(a)!<this.order.get(b)!;}
 clear(){this.buckets.clear();}
}
