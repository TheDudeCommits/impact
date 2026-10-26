export class PriorityQueue<K> {
  private running=0;private background=true;
  setBackground(on:boolean){this.background=on;if(on)this.drain();}
  private pending:{key:K;priority:number;run:()=>Promise<void>}[]=[];
  private promises=new Map<K,Promise<void>>();
  readonly completed=new Set<K>();
  constructor(private concurrency=3){}
  request(key:K,work:()=>Promise<void>,priority=1):Promise<void>{
    if(this.completed.has(key))return Promise.resolve();
    const have=this.promises.get(key);if(have){const queued=this.pending.find(t=>t.key===key);if(queued)queued.priority=Math.max(priority,queued.priority);queueMicrotask(()=>this.drain());return have;}
    let resolve!:()=>void,reject!:(reason:unknown)=>void;
    const promise=new Promise<void>((ok,no)=>{resolve=ok;reject=no;});this.promises.set(key,promise);
    this.pending.push({key,priority,run:async()=>{try{await work();this.completed.add(key);resolve();}catch(error){reject(error);}finally{this.promises.delete(key);}}});
    queueMicrotask(()=>this.drain());return promise;
  }
  private drain(){
    this.pending.sort((a,b)=>b.priority-a.priority);
    while(this.pending.length&&this.running<this.concurrency){if(this.pending[0].priority===0&&(!this.background||this.running>=1))return;const task=this.pending.shift()!;this.running++;void task.run().finally(()=>{this.running--;this.drain();});}
  }
}
