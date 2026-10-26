export const AAC_PRIMING = 2112, AAC_FRAME = 1024;

export const untrimmedFrames = (frames: number) => Math.ceil((frames + AAC_PRIMING) / AAC_FRAME) * AAC_FRAME;

const SAME = .002;

export function aacWindow(length: number, sampleRate: number, [frames, rate]: readonly [number, number]): { start: number; length: number } | undefined {
  const seconds = length / sampleRate, want = frames / rate;
  if (Math.abs(seconds - want) <= SAME) return { start: 0, length };
  if (!(Math.abs(seconds - untrimmedFrames(frames) / rate) <= SAME)) return undefined;
  const start = Math.round(AAC_PRIMING * sampleRate / rate);
  return { start, length: Math.min(length - start, Math.round(want * sampleRate)) };
}

export function trimAac(context: Pick<BaseAudioContext, 'createBuffer'>, buffer: AudioBuffer, bank: readonly [number, number]): AudioBuffer | undefined {
  const window = aacWindow(buffer.length, buffer.sampleRate, bank);
  if (!window) return undefined;
  if (window.start === 0) return buffer;
  const out = context.createBuffer(buffer.numberOfChannels, window.length, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++)
    out.copyToChannel(buffer.getChannelData(channel).subarray(window.start, window.start + window.length), channel);
  return out;
}
