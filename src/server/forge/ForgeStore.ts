import fs from 'node:fs';
import path from 'node:path';
import type { FighterId } from '../../game/types';
import { decodeForge, forgeProblems, type ForgeKit } from '../../engine/sim/forge';
import { shortForgeHash } from '../../engine/sim/forgedKits';
import { refusedName } from '../displayName';

export const FORGE_KEEP = 30, FORGE_SAVES_PER_DAY = 40;

export interface StoredKit { hash: string; code: string; owner: string; name: string; body: FighterId; at: number }
type Line = { t: 'save'; kit: StoredKit } | { t: 'remove'; hash: string; owner: string; at: number };

export class ForgeRefusal extends Error {}
const refuse = (message: string): never => { throw new ForgeRefusal(message); };

export class ForgeStore {
  private readonly kits = new Map<string, StoredKit>();
  private readonly saves = new Map<string, number[]>();
  private readonly file?: string;

  constructor(dir?: string, private readonly now: () => number = Date.now) {
    if (!dir) return;
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'forge.jsonl');
    if (!fs.existsSync(this.file)) return;
    for (const raw of fs.readFileSync(this.file, 'utf8').split('\n')) {
      if (!raw.trim()) continue;
      try { this.apply(JSON.parse(raw) as Line); } catch { }
    }
  }
  private apply(line: Line) {
    if (line.t === 'save') this.kits.set(line.kit.hash, line.kit);
    else if (this.kits.get(line.hash)?.owner === line.owner) this.kits.delete(line.hash);
  }
  private write(line: Line) {
    if (this.file) fs.appendFileSync(this.file, `${JSON.stringify(line)}\n`, { flush: true } as fs.WriteFileOptions);
    this.apply(line);
  }

  save(owner: string, code: unknown): StoredKit {
    if (typeof code !== 'string' || code.length > 4096) refuse("That isn't a Forge code.");
    let kit: ForgeKit;
    try { kit = decodeForge(code as string); } catch (error) { return refuse((error as Error).message); }
    const { errors } = forgeProblems(kit, { availability: 'released' });
    if (errors.length) refuse(`That forged fighter can't be kept: ${errors[0]}`);
    if (refusedName(kit.name.trim())) refuse('That name is not allowed.');
    const hash = shortForgeHash(kit), kept = this.kits.get(hash);
    if (kept && kept.owner === owner) return kept;
    const mine = this.mine(owner);
    if (mine.length >= FORGE_KEEP) refuse(`You keep ${FORGE_KEEP} forged fighters already: remove one first.`);
    const day = this.now() - 86400_000, recent = (this.saves.get(owner) ?? []).filter(at => at > day);
    if (recent.length >= FORGE_SAVES_PER_DAY) refuse('That is enough forging for today. Try again tomorrow.');
    this.saves.set(owner, [...recent, this.now()]);
    const stored: StoredKit = { hash, code: code as string, owner, name: kit.name.trim(), body: kit.body, at: this.now() };
    this.write({ t: 'save', kit: stored });
    return stored;
  }
  mine(owner: string): StoredKit[] {
    return [...this.kits.values()].filter(kit => kit.owner === owner).sort((a, b) => b.at - a.at);
  }
  get(hash: unknown): Omit<StoredKit, 'owner'> | undefined {
    if (typeof hash !== 'string' || !/^[0-9a-f]{16}$/.test(hash)) return undefined;
    const kit = this.kits.get(hash);
    if (!kit) return undefined;
    const { owner: _owner, ...shared } = kit;
    return shared;
  }
  remove(owner: string, hash: unknown) {
    if (typeof hash !== 'string' || this.kits.get(hash)?.owner !== owner) refuse('That forged fighter is not yours to remove.');
    this.write({ t: 'remove', hash: hash as string, owner, at: this.now() });
  }
}
