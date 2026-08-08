import { describe, it, expect } from 'vitest';
import {
  normalizeAccessories,
  ACCESSORY_SLOTS,
  ACCESSORY_OPTIONS,
  SLOT_ORDER,
} from '../agent/avatarConfig';

describe('avatarConfig 3D accessories', () => {
  it('normalizes legacy single accessory string into array', () => {
    const result = normalizeAccessories({ accessory: 'glasses' });
    expect(result).toEqual(['glasses']);
  });

  it('normalizes new accessories array and preserves one pick per slot', () => {
    const config = {
      accessories: ['top_hat', 'glasses', 'tie', 'headset'],
    };
    const result = normalizeAccessories(config);
    expect(result).toHaveLength(4);
    expect(result).toContain('top_hat');
    expect(result).toContain('glasses');
    expect(result).toContain('tie');
    expect(result).toContain('headset');
  });

  it('supports new accessory options (cowboy_hat, sunglasses, bowtie, etc.)', () => {
    expect(ACCESSORY_SLOTS['cowboy_hat']).toBe('head');
    expect(ACCESSORY_SLOTS['sunglasses']).toBe('face');
    expect(ACCESSORY_SLOTS['square_glasses']).toBe('face');
    expect(ACCESSORY_SLOTS['bowtie']).toBe('neck');

    const config = {
      accessories: ['cowboy_hat', 'sunglasses', 'bowtie'],
    };
    const result = normalizeAccessories(config);
    expect(result).toEqual(['cowboy_hat', 'sunglasses', 'bowtie']);
  });
});
