import type { Settlement } from '../../game/economy/account';
import type { Report } from '../../game/economy/earn';

export interface Completion {
  matchId: string; pk: string; completedAt: number; report: Report; settlement: Settlement;
}
