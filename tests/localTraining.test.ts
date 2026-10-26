import { describe, expect, it } from 'vitest';
import { LocalTraining } from '../src/network';
import type { PlayerInput } from '../src/game/types';

const neutral = (seq: number): PlayerInput => ({ seq, moveX: 0, moveZ: 0, yaw: 0 });

describe('training, played in this browser', () => {
  it('is the training room: the exam hall, the player and a sparring bot', async () => {
    const practice = new LocalTraining();
    try {
      await practice.connect('levi', 'Tester');
      const s = practice.snapshot!;
      expect(practice.id).toBe(LocalTraining.PLAYER);
      expect(s.roomMode).toBe('training');
      expect(s.players.find(p => p.id === practice.id)?.fighter).toBe('levi');
      expect(s.players.filter(p => p.isBot)).toHaveLength(1);
      expect(practice.predictionReady).toBe(true);
    } finally { await practice.leave(); }
  }, 60_000);

  it('steps one tick a command, and every command is a fresh snapshot: it never reads as a dropped connection', async () => {
    const practice = new LocalTraining();
    try {
      await practice.connect('aizen', 'Tester');
      const start = practice.snapshot!.serverTime;
      for (let i = 1; i <= 60; i++) {
        const before = performance.now();
        expect(practice.send(neutral(i))).toBe(true);
        expect(practice.receivedAt).toBeGreaterThanOrEqual(before);
      }
      expect(practice.snapshot!.serverTime - start).toBeCloseTo(1, 5);
    } finally { await practice.leave(); }
  }, 60_000);

  it('takes the training panel: the bot held still, the meters filled, everyone reset', async () => {
    const practice = new LocalTraining();
    try {
      await practice.connect('sukuna', 'Tester');
      practice.room!.send('training', 'passive');
      practice.room!.send('training', 'awakening');
      practice.send(neutral(1));
      const me = () => practice.snapshot!.players.find(p => p.id === practice.id)!;
      expect(practice.snapshot!.trainingBotMode).toBe('passive');
      expect(me().ultimate).toBe(100);
      practice.room!.send('training', 'reset');
      practice.send(neutral(2));
      expect(practice.snapshot!.players.every(p => p.alive)).toBe(true);
    } finally { await practice.leave(); }
  }, 60_000);

  it("throws a slot pressed for the player (the Forge studio's tries): one press, aimed at the dummy, input only", async () => {
    const practice = new LocalTraining();
    try {
      await practice.connect('endeavor', 'Tester');
      practice.room!.send('training', 'passive');
      practice.room!.send('training', 'reset');
      practice.send(neutral(1));
      const me = () => practice.snapshot!.players.find(p => p.id === practice.id)!;
      const dummy = practice.snapshot!.players.find(p => p.isBot)!;
      practice.press('special');
      practice.send(neutral(2));
      expect(practice.snapshot!.events.some(e => e.kind === 'cast' && e.actorId === practice.id && e.slot === 'special')).toBe(true);
      expect(me().action).toBe('special');
      expect(Math.abs(Math.atan2(dummy.x - me().x, dummy.z - me().z) - me().yaw) % (2 * Math.PI)).toBeLessThan(1e-6);
      for (let i = 3; i < 300; i++) { practice.send(neutral(i)); expect(practice.snapshot!.events.some(e => e.kind === 'cast' && e.actorId === practice.id)).toBe(false); }
    } finally { await practice.leave(); }
  }, 60_000);

  it('holds the arena while paused (settings open, tab away), and still publishes', async () => {
    const practice = new LocalTraining();
    try {
      await practice.connect('gon', 'Tester');
      practice.send(neutral(1));
      const held = practice.snapshot!.serverTime;
      practice.paused = true;
      for (let i = 2; i < 30; i++) practice.send(neutral(i));
      expect(practice.snapshot!.serverTime).toBe(held);
      practice.paused = false;
      practice.send(neutral(30));
      expect(practice.snapshot!.serverTime).toBeGreaterThan(held);
    } finally { await practice.leave(); }
  }, 60_000);
});
