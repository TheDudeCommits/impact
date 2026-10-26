export type CallKind = 'presence' | 'store' | 'rpc';
export type Up =
  | { t: 'q'; id: number; k: CallKind; m: string; a: unknown[] }
  | { t: 'r'; id: number; ok: boolean; v?: unknown; e?: WireError }
  | { t: 'sub' | 'unsub'; topic: string }
  | { t: 'pub'; topic: string; data: unknown }
  | { t: 'hello'; role: ClusterRole; index: number; processId: string; port: number };
export type Down =
  | { t: 'r'; id: number; ok: boolean; v?: unknown; e?: WireError }
  | { t: 'q'; id: number; k: 'rpc'; m: string; a: unknown[] }
  | { t: 'ev'; topic: string; data: unknown };
export interface WireError { message: string; code?: number | string }
export type ClusterRole = 'control' | 'rooms';

export const toWire = (error: unknown): WireError => {
  const e = error as { message?: unknown; code?: unknown } | undefined;
  const message = typeof e?.message === 'string' ? e.message : String(error);
  return typeof e?.code === 'number' || typeof e?.code === 'string' ? { message, code: e.code } : { message };
};
export const fromWire = (wire: WireError | undefined) => Object.assign(new Error(wire?.message ?? 'cluster call failed'), wire?.code !== undefined ? { code: wire.code } : {});

type Send = (message: Up) => void;
type Receive = (listener: (message: Down) => void) => void;

export class Link {
  private next = 1;
  private readonly waiting = new Map<number, { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }>();
  private readonly listeners = new Map<string, Set<(data: unknown) => void>>();
  private readonly handlers = new Map<string, (...args: unknown[]) => unknown>();

  constructor(private readonly send: Send, receive: Receive) {
    receive(message => {
      if (message.t === 'r') {
        const call = this.waiting.get(message.id); if (!call) return;
        this.waiting.delete(message.id); clearTimeout(call.timer);
        if (message.ok) call.resolve(message.v); else call.reject(fromWire(message.e));
      } else if (message.t === 'ev') {
        for (const listener of [...this.listeners.get(message.topic) ?? []]) {
          try { listener(message.data); } catch (error) { console.error(`[cluster] a listener of ${message.topic} threw`, error); }
        }
      } else if (message.t === 'q') void this.answer(message);
    });
  }

  call<T = unknown>(k: CallKind, m: string, a: unknown[] = [], timeoutMs = 10_000): Promise<T> {
    const id = this.next++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { this.waiting.delete(id); reject(new Error(`cluster ${k} ${m} timed out`)); }, timeoutMs);
      timer.unref?.();
      this.waiting.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      try { this.send({ t: 'q', id, k, m, a }); } catch (error) { this.waiting.delete(id); clearTimeout(timer); reject(error as Error); }
    });
  }
  subscribe(topic: string, listener: (data: unknown) => void) {
    let set = this.listeners.get(topic);
    if (!set) { this.listeners.set(topic, set = new Set()); this.send({ t: 'sub', topic }); }
    set.add(listener);
  }
  unsubscribe(topic: string, listener?: (data: unknown) => void) {
    const set = this.listeners.get(topic); if (!set) return;
    if (listener) set.delete(listener); else set.clear();
    if (!set.size) { this.listeners.delete(topic); this.send({ t: 'unsub', topic }); }
  }
  publish(topic: string, data: unknown) { this.send({ t: 'pub', topic, data }); }
  hello(role: ClusterRole, index: number, processId: string, port: number) { this.send({ t: 'hello', role, index, processId, port }); }

  handle(method: string, run: (...args: unknown[]) => unknown) { this.handlers.set(method, run); }
  private async answer(message: Extract<Down, { t: 'q' }>) {
    const run = this.handlers.get(message.m);
    try {
      if (!run) throw new Error(`no handler for ${message.m}`);
      this.send({ t: 'r', id: message.id, ok: true, v: await run(...message.a) });
    } catch (error) { this.send({ t: 'r', id: message.id, ok: false, e: toWire(error) }); }
  }
}

let link: Link | undefined;
export function clusterLink(): Link | undefined {
  if (link || !process.send || !process.env.CLUSTER_ROLE) return link;
  const send = process.send.bind(process);
  link = new Link(message => { send(message); }, listener => { process.on('message', message => listener(message as Down)); });
  return link;
}
export const clusterRole = (): ClusterRole | undefined => process.env.CLUSTER_ROLE === 'control' || process.env.CLUSTER_ROLE === 'rooms' ? process.env.CLUSTER_ROLE : undefined;
export const clusterIndex = () => clusterRole() === 'rooms' ? Number(process.env.CLUSTER_INDEX) || 0 : 0;
export const clusterSize = () => clusterRole() ? Number(process.env.CLUSTER_SIZE) || 0 : 0;
