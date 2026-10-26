export class ObservedSize {
  width=0;
  height=0;
  private readonly observer:ResizeObserver;
  constructor(element:Element){
    this.observer=new ResizeObserver(entries=>{
      for(const {target,contentRect} of entries)if(target===element){
        this.width=contentRect.width;this.height=contentRect.height;
      }
    });
    this.observer.observe(element);
  }
  dispose(){this.observer.disconnect();}
}
