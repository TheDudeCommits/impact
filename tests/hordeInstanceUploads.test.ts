import { expect, it } from 'vitest';
import { InstancedBufferAttribute } from 'three';
import { uploadInstances } from '../src/render/horde/instanceUploads';

it('uploads all occupied components as a pool shrinks and grows without changing its data', () => {
  const attribute = new InstancedBufferAttribute(new Float32Array(220 * 4).fill(7), 4);
  uploadInstances(attribute, 80);
  const range = attribute.updateRanges[0];
  expect(range).toEqual({ start: 0, count: 320 });
  attribute.clearUpdateRanges();
  uploadInstances(attribute, 6);
  expect(attribute.updateRanges).toEqual([{ start: 0, count: 24 }]);
  expect(attribute.updateRanges[0]).toBe(range);
  attribute.clearUpdateRanges();
  uploadInstances(attribute, 220);
  expect(attribute.updateRanges).toEqual([{ start: 0, count: 880 }]);
  expect(attribute.version).toBe(3);
  expect(attribute.array.every(n => n === 7)).toBe(true);
});

it('does not upload an empty pool and cannot read beyond the allocated buffer', () => {
  const attribute = new InstancedBufferAttribute(new Float32Array(3 * 16), 16);
  uploadInstances(attribute, 0);
  expect(attribute.version).toBe(0);
  expect(attribute.updateRanges).toEqual([]);
  uploadInstances(attribute, 100);
  expect(attribute.updateRanges).toEqual([{ start: 0, count: 48 }]);
});
