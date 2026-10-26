import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../simulation';

function lab() {
  const sim = new ArenaSimulation({ roomMode: 'training', seed: 7 });
  sim.addPlayer('you', 'naruto', 'You'); sim.trainingCommand('you', 'passive');
  const command = (name: string, value?: unknown) => sim.trainingCommand('you', { lab: name, value });
  return { sim, command };
}
describe('training laboratory authority', () => {
  it('uses exact 60 Hz steps at quarter speed and while frozen', () => {
    const { sim, command } = lab(); try {
      command('speed', .25); for (let i = 0; i < 60; i++) sim.step();
      expect(sim.tick).toBe(15); expect(sim.serverTime).toBeCloseTo(.25);
      command('freeze', true); for (let i = 0; i < 60; i++) sim.step(); expect(sim.tick).toBe(15);
      command('step'); for (let i = 0; i < 60; i++) sim.step(); expect(sim.tick).toBe(16);
      command('freeze', false); for (let i = 0; i < 4; i++) sim.step(); expect(sim.tick).toBe(17);
    } finally { sim.dispose(); }
  });
  it('records dummy inputs, retains multiple slots, and replays a bounded tape', () => {
    const { sim, command } = lab(); try {
      command('record');
      for (let i = 1; i <= 30; i++) { sim.submitInput('you', { seq: i, moveX: 1, moveZ: 0, yaw: 0 }); sim.step(); }
      command('stop'); expect(sim.trainingLab.view().slots).toEqual([30, 0, 0]);
      expect(sim.getPlayer('you')!.x).toBeCloseTo(0); expect(sim.getPlayer('sparring-bot')!.x).toBeLessThan(0);
      command('slot', 1); command('record'); sim.step(); command('stop'); expect(sim.trainingLab.view().slots).toEqual([30, 1, 0]);
      command('slot', 0); command('play'); for (let i = 0; i < 65; i++) sim.step();
      expect(sim.trainingLab.view().cursor).toBe(65); expect(sim.getPlayer('sparring-bot')!.x).toBeLessThan(0);
    } finally { sim.dispose(); }
  });
  it('resets both fighters, changes the opponent and only guards after a real hit', () => {
    const { sim, command } = lab(); try {
      command('opponent', 'goku'); expect(sim.getPlayer('sparring-bot')!.fighter).toBe('goku');
      command('behaviour', 'after-hit'); sim.step(); expect(sim.getPlayer('sparring-bot')!.guarding).toBe(false);
      sim.damage('sparring-bot', 30, 'you', 'test'); for (let i = 0; i < 100; i++) sim.step();
      expect(sim.getPlayer('sparring-bot')!.guarding).toBe(true);
      command('behaviour', 'passive'); command('behaviour', 'after-hit'); sim.step(); expect(sim.getPlayer('sparring-bot')!.guarding).toBe(false);
      sim.trainingCommand('you', 'reset'); sim.step(); expect(sim.getPlayer('sparring-bot')!.guarding).toBe(false);
      expect(sim.getPlayer('sparring-bot')!.hp).toBe(sim.getPlayer('sparring-bot')!.maxHp);
      expect(sim.getPlayer('you')!.z).toBeCloseTo(3);
    } finally { sim.dispose(); }
  });
  it('cannot freeze or alter a competitive match through training commands', () => {
    const sim = new ArenaSimulation({ roomMode: 'match' }); try {
      sim.addPlayer('you', 'naruto', 'You'); sim.addPlayer('them', 'goku', 'Them'); sim.startMatch();
      expect(sim.trainingCommand('you', { lab: 'freeze', value: true })).toBe(false); sim.step(); expect(sim.tick).toBe(1);
    } finally { sim.dispose(); }
  });
  it('teaches an achievable perfect-guard punish and resets the next repetition', () => {
    const { sim, command } = lab(); try {
      command('opponent', 'naruto'); command('behaviour', 'punish');
      let parried = -100, success = false;
      for (let frame = 0; frame < 365; frame++) {
        const a = sim.getPlayer('you')!, b = sim.getPlayer('sparring-bot')!, dx = b.x-a.x, dz = b.z-a.z, d = Math.hypot(dx,dz)||1, answer = frame-parried;
        sim.submitInput('you', { seq: frame+1, moveX: answer<30?dx/d:0, moveZ: answer<30?dz/d:0, yaw: Math.atan2(dx,dz),
          guard: frame>=86&&answer>30, attack: answer===3?'light':undefined, targetId: b.id, lock: true });
        sim.step();
        for (const e of sim.drainEvents()) if (e.actorId==='sparring-bot'&&e.kind==='just-guard') parried=frame;
        success ||= sim.trainingLab.view().drill.successes===1;
      }
      expect(success).toBe(true); expect(sim.trainingLab.view().drill.attempts).toBe(2);
      command('drill-move', 'special'); expect(sim.trainingLab.view().drill).toMatchObject({ move:'special',attempts:0,successes:0 });
    } finally { sim.dispose(); }
  });
  it('does not count a hit after the dummy has recovered as a punish', () => {
    const { sim, command } = lab(); try {
      command('opponent', 'naruto'); command('behaviour', 'punish');
      for (let i=0;i<160;i++) { sim.submitInput('you',{seq:i+1,moveX:0,moveZ:0,yaw:Math.PI,guard:true}); sim.step(); }
      expect(sim.trainingLab.view().drill.cue).toContain('recovered');
      sim.damage('sparring-bot',20,'you','Late hit');
      expect(sim.trainingLab.view().drill.successes).toBe(0);
    } finally { sim.dispose(); }
  });
});
