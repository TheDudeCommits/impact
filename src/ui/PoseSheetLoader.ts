export type PoseImage={source:CanvasImageSource;width:number;height:number;close:()=>void};
export type PoseLoaderIO={fetchBlob:(url:string,signal:AbortSignal)=>Promise<Blob>;decode:(blob:Blob)=>Promise<PoseImage>};

const browserIO:PoseLoaderIO={
  async fetchBlob(url,signal){
    const response=await fetch(url,{signal,cache:'force-cache',priority:'high'});
    if(!response.ok)throw new Error(`Pose image returned ${response.status}`);
    return response.blob();
  },
  async decode(blob){
    if(typeof createImageBitmap==='function'){
      const image=await createImageBitmap(blob);
      return {source:image,width:image.width,height:image.height,close:()=>image.close()};
    }
    const image=new Image(),url=URL.createObjectURL(blob);image.decoding='async';
    image.src=url;
    try{await image.decode();}
    catch(error){image.removeAttribute('src');throw error;}
    finally{URL.revokeObjectURL(url);}
    return {source:image,width:image.naturalWidth,height:image.naturalHeight,close:()=>image.removeAttribute('src')};
  },
};

export class PoseSheetLoader {
  private decoded=new Map<string,PoseImage>();
  private encoded=new Map<string,Blob>();
  private decodedBytes=0;
  private encodedBytes=0;
  private reservedBytes=0;
  private sequence=0;
  private pending?:{url:string;controller:AbortController;promise:Promise<PoseImage|undefined>};
  private decodeQueue:Promise<unknown>=Promise.resolve();
  private disposed=false;

  constructor(private io:PoseLoaderIO=browserIO,private limits={decodedBytes:48*1024*1024,encodedBytes:8*1024*1024,decodedEntries:8}){}

  get(url:string){
    const image=this.decoded.get(url);
    if(image){this.decoded.delete(url);this.decoded.set(url,image);}
    return image;
  }
  get stats(){return {decodedBytes:this.decodedBytes,reservedBytes:this.reservedBytes,encodedBytes:this.encodedBytes,decodedEntries:this.decoded.size,encodedEntries:this.encoded.size};}

  load(url:string,expectedDecodedBytes:number):Promise<PoseImage|undefined>{
    if(this.disposed)return Promise.resolve(undefined);
    const cached=this.get(url);
    if(cached){this.cancel();return Promise.resolve(cached);}
    if(this.pending?.url===url)return this.pending.promise;
    this.cancel();
    const sequence=this.sequence,controller=new AbortController();
    const isCurrent=()=>!this.disposed&&sequence===this.sequence;
    const promise=(async()=>{
      let blob=this.encoded.get(url);
      if(blob){this.encoded.delete(url);this.encoded.set(url,blob);}
      else{
        blob=await this.io.fetchBlob(url,controller.signal);
        if(!isCurrent())return;
        this.rememberEncoded(url,blob);
      }
      const decode=this.decodeQueue.then(async()=>{
        if(!isCurrent())return;
        const reservation=Math.max(1,expectedDecodedBytes);
        if(reservation>this.limits.decodedBytes)throw new Error('Pose image exceeds decode budget');
        while(this.decoded.size&&(this.decodedBytes+reservation>this.limits.decodedBytes||this.decoded.size>=this.limits.decodedEntries))this.evictDecoded();
        this.reservedBytes=reservation;
        let image:PoseImage;
        try{image=await this.io.decode(blob!);}finally{this.reservedBytes=0;}
        if(!isCurrent()){image.close();return;}
        const bytes=image.width*image.height*4;
        if(bytes>this.limits.decodedBytes){image.close();throw new Error('Pose image exceeds decode budget');}
        while(this.decoded.size&&this.decodedBytes+bytes>this.limits.decodedBytes)this.evictDecoded();
        this.decoded.set(url,image);this.decodedBytes+=bytes;
        return image;
      });
      this.decodeQueue=decode.catch(()=>{});
      return decode;
    })().catch(error=>{
      if(!isCurrent()||controller.signal.aborted)return undefined;
      throw error;
    }).finally(()=>{if(this.pending?.promise===promise)this.pending=undefined;});
    this.pending={url,controller,promise};
    return promise;
  }
  cancel(){this.sequence++;this.pending?.controller.abort();this.pending=undefined;}
  releaseDecoded(){this.cancel();while(this.decoded.size)this.evictDecoded();}
  dispose(){this.disposed=true;this.releaseDecoded();this.encoded.clear();this.encodedBytes=0;}

  private evictDecoded(){
    const entry=this.decoded.entries().next().value;if(!entry)return;
    const [url,image]=entry;this.decoded.delete(url);this.decodedBytes-=image.width*image.height*4;image.close();
  }
  private rememberEncoded(url:string,blob:Blob){
    if(blob.size>this.limits.encodedBytes)return;
    while(this.encoded.size&&this.encodedBytes+blob.size>this.limits.encodedBytes){
      const oldest=this.encoded.entries().next().value!;this.encoded.delete(oldest[0]);this.encodedBytes-=oldest[1].size;
    }
    this.encoded.set(url,blob);this.encodedBytes+=blob.size;
  }
}
