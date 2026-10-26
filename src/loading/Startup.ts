export interface LoadStage { name:string; state:'pending'|'loading'|'ready'|'failed'; ms:number }
export class Startup {
  readonly stages:LoadStage[]=[];
  private completed=new Set<string>();
  private active=new Map<string,number>();
  started=performance.now();
  readyMs:number|null=null;
  onChange=()=>{};
  async stage(name:string,task:()=>Promise<unknown>){
    if(this.completed.has(name))return;
    let row=this.stages.find(row=>row.name===name);
    if(!row){row={name,state:'pending',ms:0};this.stages.push(row);}
    row.state='loading';this.active.set(name,performance.now());this.onChange();
    try{await task();row.state='ready';this.completed.add(name);}
    catch(error){row.state='failed';throw error;}
    finally{row.ms=Math.round(performance.now()-this.active.get(name)!);this.active.delete(name);this.onChange();}
  }
  snapshot(){return {elapsedMs:Math.round(performance.now()-this.started),readyMs:this.readyMs,stages:this.stages.map(row=>({...row,ms:this.active.has(row.name)?Math.round(performance.now()-this.active.get(row.name)!):row.ms}))};}
}
