import { describe, expect, it } from 'vitest';
import { AAC_FRAME, AAC_PRIMING, aacWindow, trimAac, untrimmedFrames } from '../src/audio/aacTrim';

const decoded = (channels: Float32Array[], sampleRate = 48000) => ({
  length: channels[0].length, sampleRate, numberOfChannels: channels.length, duration: channels[0].length / sampleRate,
  getChannelData: (channel: number) => channels[channel],
}) as unknown as AudioBuffer;
const context = () => ({
  createBuffer: (numberOfChannels: number, length: number, sampleRate: number) => {
    const data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    return { ...decoded(data, sampleRate), copyToChannel: (from: Float32Array, channel: number) => data[channel].set(from) } as unknown as AudioBuffer;
  },
});

describe('the AAC encoder delay (aacTrim)', () => {
  it('knows how long afconvert\'s stream is for a clip: its delay and its frames, rounded up to a whole AAC frame', () => {
    expect(AAC_PRIMING).toBe(0x840);
    expect(AAC_FRAME).toBe(1024);
    expect(untrimmedFrames(15756)).toBe(18 * 1024);
    expect(untrimmedFrames(15756) - AAC_PRIMING - 15756).toBe(0x234);
    expect(untrimmedFrames(62400) - AAC_PRIMING - 62400).toBe(0);
    expect(untrimmedFrames(34753) - AAC_PRIMING - 34753).toBe(1023);
  });

  it('uses a buffer as it is where the browser already trimmed it (Chrome, Safari)', () => {
    expect(aacWindow(15756, 48000, [15756, 48000])).toEqual({ start: 0, length: 15756 });
    const buffer = decoded([new Float32Array(15756)]);
    expect(trimAac(context(), buffer, [15756, 48000])).toBe(buffer);
  });

  it('cuts the delay off the start and the padding off the end of a whole stream (Firefox)', () => {
    for (const frames of [6601, 15756, 34753, 62400, 368640]) {
      const whole = untrimmedFrames(frames);
      expect(aacWindow(whole, 48000, [frames, 48000]), `${frames} frames`).toEqual({ start: 2112, length: frames });
    }
  });

  it('moves every sample by the delay and no other, in every channel', () => {
    const frames = 5000, whole = untrimmedFrames(frames);
    const left = Float32Array.from({ length: whole }, (_, i) => i), right = Float32Array.from({ length: whole }, (_, i) => -i);
    const trimmed = trimAac(context(), decoded([left, right]), [frames, 48000])!;
    expect(trimmed.length).toBe(frames);
    expect(trimmed.numberOfChannels).toBe(2);
    expect(trimmed.sampleRate).toBe(48000);
    for (const i of [0, 1, 2999, frames - 1]) {
      expect(trimmed.getChannelData(0)[i]).toBe(2112 + i);
      expect(trimmed.getChannelData(1)[i]).toBe(-(2112 + i));
    }
  });

  it('puts the delay in the context\'s samples where the decode was resampled (a 44.1 kHz context)', () => {
    expect(aacWindow(16935, 44100, [15756, 48000])).toEqual({ start: 1940, length: 14476 });
    expect(aacWindow(16934, 44100, [15756, 48000])?.start).toBe(1940);
    expect(aacWindow(16936, 44100, [15756, 48000])?.start).toBe(1940);
    expect(aacWindow(14475, 44100, [15756, 48000])?.start).toBe(0);
    expect(aacWindow(14476, 44100, [15756, 48000])?.start).toBe(0);
  });

  it('refuses a length that is neither, so the WAV is heard', () => {
    for (const length of [15756 + 564, 15756 + 2112, 18432 + 1024, 18432 - 1024, 15756 + 200, 15756 - 200, 0, 1000000])
      expect(aacWindow(length, 48000, [15756, 48000]), `${length} samples`).toBeUndefined();
    expect(trimAac(context(), decoded([new Float32Array(15756 + 2112)]), [15756, 48000])).toBeUndefined();
    expect(aacWindow(NaN, 48000, [15756, 48000])).toBeUndefined();
  });

  it('never mistakes the two lengths for each other: they are at least the delay apart', () => {
    for (const frames of [1, 100, 1023, 1024, 1025, 48000]) {
      const trimmed = aacWindow(frames, 48000, [frames, 48000]), whole = aacWindow(untrimmedFrames(frames), 48000, [frames, 48000]);
      expect(trimmed?.start, `${frames}`).toBe(0);
      expect(whole?.start, `${frames}`).toBe(2112);
    }
  });
});
