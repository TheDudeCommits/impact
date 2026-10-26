import type {GameSnapshot} from '../types';
export const assetSignature=(s:GameSnapshot)=>`${s.stage??'harbor'}:${[...new Set(s.players.filter(p=>!p.enemy).map(p=>p.fighter))].sort().join(',')}`;
