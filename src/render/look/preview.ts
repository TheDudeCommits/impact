import { STAGES, type StageId } from '../../game/stages';

export function previewStage(stage: StageId): StageId {
  if (!import.meta.env?.DEV || typeof location === 'undefined' || stage === 'harbor') return stage;
  const wanted = new URLSearchParams(location.search).get('look');
  return wanted && wanted !== 'harbor' && wanted in STAGES ? wanted as StageId : stage;
}
