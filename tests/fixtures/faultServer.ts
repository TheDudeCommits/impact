import { ArenaSimulation } from '../../src/game/simulation';

const step = ArenaSimulation.prototype.step;
ArenaSimulation.prototype.step = function (this: ArenaSimulation, ...args: Parameters<ArenaSimulation['step']>) {
  for (const actor of this.actors.values()) if (actor.state.name === 'Tick Fault') throw new Error('planted tick fault');
  return step.apply(this, args);
};
const command = ArenaSimulation.prototype.trainingCommand;
ArenaSimulation.prototype.trainingCommand = function (this: ArenaSimulation, id: string, raw: unknown) {
  if (raw === 'handler-fault') throw new Error('planted handler fault');
  if (raw === 'stray-exception') setTimeout(() => { throw new Error('planted stray exception'); });
  if (raw === 'stray-rejection') void Promise.reject(new Error('planted stray rejection'));
  return command.call(this, id, raw);
};

await import('../../src/server/index');
