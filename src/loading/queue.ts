export async function loadQueue<T>(items:readonly T[], task:(item:T)=>Promise<void>, concurrency=3){
  let next=0,failed=false,error:unknown;
  await Promise.all(Array.from({length:Math.min(items.length,Math.max(1,concurrency))},async()=>{
    while(!failed&&next<items.length){
      const item=items[next++];
      try{await task(item);}catch(reason){failed=true;error??=reason;}
    }
  }));
  if(failed)throw error;
}
