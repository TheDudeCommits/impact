import { identityPlayer, playerTwo, type PlayerTwoApi } from '../../boot/playerTwo';
import { account as browserAccount, type AccountClient, type Store } from './account';

const P2_KEY = 'jump-p2-player';

export interface PlayerTwoSignInDeps {
  account: Pick<AccountClient, 'wallet' | 'known' | 'signInPlayerTwo'>;
  find: () => Promise<PlayerTwoApi | undefined>;
  local: Store;
}
const storage: Store = {
  get: key => { try { return localStorage.getItem(key) ?? undefined; } catch { return undefined; } },
  set: (key, value) => { try { if (value === undefined) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { } },
};

export async function signInWithPlayerTwo(deps: PlayerTwoSignInDeps = { account: browserAccount, find: playerTwo, local: storage }): Promise<boolean> {
  const p2 = await deps.find();
  if (!p2) return false;
  const identity = await p2.identity(), player = identityPlayer(identity);
  const { wallet } = deps.account;
  if (player && deps.account.known && wallet.live && wallet.signedIn && deps.local.get(P2_KEY) === player) return false;
  const handle = p2.player?.handle;
  await deps.account.signInPlayerTwo(identity, `with Player Two${handle ? ` as @${handle}` : ''}`);
  deps.local.set(P2_KEY, player);
  return true;
}
