import type { Camera } from 'three';

export const hudView: { camera?: Camera; locked: () => boolean } = { locked: () => false };
