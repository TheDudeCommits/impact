import {it,expect} from 'vitest';
import {PriorityQueue} from './PriorityQueue';
const tick=()=>new Promise(r=>setTimeout(r,0));
it('shares a download, promotes queued work, and limits background concurrency',async()=>{
 const q=new PriorityQueue<string>(2),order:string[]=[],release=new Map<string,()=>void>();
 const work=(id:string)=>()=>new Promise<void>(r=>{order.push(id);release.set(id,r);});
 const a=q.request('a',work('a'),0),b=q.request('b',work('b'),0),c=q.request('c',work('c'),0);await tick();expect(order).toEqual(['a']);
 const same=q.request('c',work('wrong'),1);expect(same).toBe(c);await tick();expect(order).toEqual(['a','c']);release.get('c')!();release.get('a')!();await tick();expect(order).toEqual(['a','c','b']);release.get('b')!();await Promise.all([a,b,c]);await q.request('a',work('duplicate'));expect(order).toHaveLength(3);
});
it('retries failed assets while retaining completed assets',async()=>{const q=new PriorityQueue<string>();await expect(q.request('bad',async()=>{throw new Error('offline');})).rejects.toThrow('offline');await q.request('bad',async()=>{});expect(q.completed.has('bad')).toBe(true);});
it('pauses idle roster downloads while allowing match assets through',async()=>{const q=new PriorityQueue<string>();q.setBackground(false);const order:string[]=[];const idle=q.request('idle',async()=>{order.push('idle');},0);await tick();expect(order).toEqual([]);await q.request('match',async()=>{order.push('match');});expect(order).toEqual(['match']);q.setBackground(true);await idle;expect(order).toEqual(['match','idle']);});
