import crypto from 'node:crypto';

export interface CodeGrant { allAccess?: true; items?: readonly string[]; sumi?: number }
export interface CodeDef {
  id: string;
  hash: string;
  says: string;
  grants: CodeGrant;
  email?: string;
  limit?: number;
}

export const normalCode = (code: unknown) => String(code ?? '').normalize('NFKC').trim().toLowerCase();
export const codeHash = (code: unknown) => crypto.createHash('sha256').update(`jump-code:${normalCode(code)}`).digest('hex');

export const CODES: readonly CodeDef[] = [];

export const ALL_ACCESS_ID = 'owner-all-access';
export const ALL_ACCESS_MIN = 8;

export function envCodes(env: Record<string, string | undefined> = process.env): CodeDef[] {
  const words = normalCode(env.ALL_ACCESS_CODE);
  return words.length >= ALL_ACCESS_MIN ? [{ id: ALL_ACCESS_ID, hash: codeHash(words),
    says: 'All access: every fighter, outfit and item in the game is yours, and everything added from now on.',
    grants: { allAccess: true } }] : [];
}
