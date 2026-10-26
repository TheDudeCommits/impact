import type { Room, RoomException, RoomMethodName } from 'colyseus';
import { recordServerError } from './ops/errorCounts';

export const FAULT_SECONDS = 3, CLEAN_SECONDS = .5;
export const FAULT_CLOSE_CODE = 4002;
export const FAULT_MESSAGE = 'This match was closed after a server error. Nothing else on the server was affected; start a new one.';
const LOGGED = 5;

export class RoomFaults {
  closing = false;
  private faults = 0;
  private reported = 0;
  private since = -Infinity;
  private last = -Infinity;
  constructor(private readonly room: Room) {}

  private where() { return `[${this.room.roomName ?? 'room'} ${this.room.roomId}]`; }

  guard(step: () => void) {
    if (this.closing) return;
    try { step(); } catch (error) { this.fault(error); }
  }

  fault(error: unknown, now = performance.now()) {
    if (this.closing) return;
    if (this.faults++ === 0) { console.error(`${this.where()} step failed; the room keeps running`, error); recordServerError('room step', error); }
    if (now - this.last > CLEAN_SECONDS * 1000) this.since = now;
    this.last = now;
    if (now - this.since >= FAULT_SECONDS * 1000) this.close();
  }

  report(error: RoomException, method: RoomMethodName) {
    if (method === 'onCreate' || method === 'onAuth' || method === 'onJoin') return;
    if (this.reported++ >= LOGGED) return;
    const type = 'type' in error && typeof error.type === 'string' ? ` '${error.type}'` : '';
    console.error(`${this.where()} ${method}${type} threw; contained${this.reported === LOGGED ? ' (further throws in this room go unlogged)' : ''}`, error.cause ?? error);
    recordServerError('room handler', error.cause ?? error);
  }

  private close() {
    this.closing = true;
    console.error(`${this.where()} closed: its step kept failing (${this.faults} faults in ${FAULT_SECONDS} s)`);
    recordServerError('room closed', `${this.room.roomName ?? 'room'} closed: its step kept failing`);
    for (const client of this.room.clients) { try { client.error(FAULT_CLOSE_CODE, FAULT_MESSAGE); } catch { } }
    try { void this.room.disconnect(FAULT_CLOSE_CODE).catch(error => console.error(`${this.where()} could not close`, error)); }
    catch (error) { console.error(`${this.where()} could not close`, error); }
  }
}
