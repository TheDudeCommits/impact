import { HALO } from './halo';
import type { ProtoId, ProtoSkin, Side } from './proto';

export const PROTOS: readonly ProtoSkin[] = [HALO];
export const PROTO_IDS: readonly ProtoId[] = PROTOS.map(p => p.id);
export const protoPlatesHtml = (side: Side) => PROTOS.map(p => p.plate(side)).join('');
export const protoClocksHtml = () => PROTOS.map(p => p.clock()).join('');
export { ProtoHud } from './proto';
