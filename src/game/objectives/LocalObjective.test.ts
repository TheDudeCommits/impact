import {afterEach,describe,expect,it,vi} from 'vitest';
import {LocalObjective} from './LocalObjective';
import {objectiveOf} from './model';
const rooms:LocalObjective[]=[];afterEach(async()=>{await Promise.all(rooms.splice(0).map(r=>r.leave()));vi.unstubAllGlobals();});
describe('local operations',()=>{
 it.each(['last-stand','bad-blood'] as const)('plays %s with bots without any WebSocket and pauses its authoritative clock',async kind=>{
  const socket=vi.fn(()=>{throw new Error('Local operations must not open a socket');});vi.stubGlobal('WebSocket',socket);
  const room=new LocalObjective();rooms.push(room);await room.connect('naruto','You',kind,'bots');
  expect(objectiveOf(room.snapshot)?.seats).toHaveLength(kind==='last-stand'?4:6);
  for(let seq=1;seq<200;seq++)room.send({seq,moveX:0,moveZ:0,yaw:0});expect(objectiveOf(room.snapshot)?.phase).toBe('active');
  const time=room.snapshot!.serverTime;room.paused=true;for(let seq=200;seq<260;seq++)room.send({seq,moveX:1,moveZ:0,yaw:0});expect(room.snapshot!.serverTime).toBe(time);
  room.paused=false;room.send({seq:260,moveX:0,moveZ:0,yaw:0});expect(room.snapshot!.serverTime).toBeGreaterThan(time);expect(socket).not.toHaveBeenCalled();
  await room.leave();expect(room.snapshot).toBeNull();expect(room.match).toBeNull();expect(room.predictionReady).toBe(false);
 });
 it('keeps a solo defender alone and applies purchases through its local room command',async()=>{
  const room=new LocalObjective();rooms.push(room);await room.connect('naruto','You','last-stand','solo');for(let seq=1;seq<200;seq++)room.send({seq,moveX:0,moveZ:0,yaw:0});
  expect(objectiveOf(room.snapshot)?.seats).toHaveLength(1);const g=room.match!;g.sim.place(room.id,{x:-11,y:0,z:24});g.siege!.view.points=650;room.room!.send('objective-buy','walls');expect(objectiveOf(room.snapshot)?.village?.maxHp).toBe(15000);expect(objectiveOf(room.snapshot)?.village?.points).toBe(0);
 });
});
