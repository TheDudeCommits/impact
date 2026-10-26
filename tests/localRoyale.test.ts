import {describe,it,expect} from 'vitest';
import {LocalRoyale} from '../src/game/LocalRoyale';

describe('offline bot royale',()=>{
  it('drafts the chosen field, pauses locally, and ends without an account receipt',async()=>{
    const local=new LocalRoyale();try {
      await local.connect('naruto','You',6);
      expect(local.snapshot!.players).toHaveLength(6);expect(new Set(local.snapshot!.players.map(p=>p.fighter)).size).toBe(6);
      for(let i=0;i<190;i++)local.send({seq:i+1,moveX:0,moveZ:0,yaw:0});
      expect(local.snapshot!.status).toBe('active');expect(local.snapshot!.duel).toBeUndefined();
      local.paused=true;const time=local.snapshot!.serverTime;local.send({seq:191,moveX:1,moveZ:0,yaw:0});expect(local.snapshot!.serverTime).toBe(time);
      local.paused=false;for(const p of local.snapshot!.players)if(p.isBot)local.sim!.damage(p.id,1e6,'you','KO');
      local.send({seq:192,moveX:0,moveZ:0,yaw:0});expect(local.snapshot!.status).toBe('finished');expect(local.snapshot!.winnerId).toBe('you');
      expect(local.snapshot!.matchId).toBeUndefined();expect(local.snapshot!.reward).toBeUndefined();
    } finally {await local.leave();}
  },60000);
  it('plays a field it is given at the place it is given, and drafts its own when the field is not whole',async()=>{
    const local=new LocalRoyale();try {
      const field=['luffy','ichigo','vegeta','tanjiro','gojo'] as const;
      await local.connect('naruto','You',6,'shibuya',[...field]);
      expect(local.snapshot!.stage).toBe('shibuya');
      expect(local.snapshot!.players.filter(p=>p.isBot).map(p=>p.fighter)).toEqual([...field]);
      await local.connect('naruto','You',6,'shibuya',['luffy','ichigo']);
      const bots=local.snapshot!.players.filter(p=>p.isBot).map(p=>p.fighter);
      expect(bots).toHaveLength(5);expect(bots).not.toContain('naruto');
    } finally {await local.leave();}
  },60000);
});
