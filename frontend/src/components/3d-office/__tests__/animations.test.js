import { describe, it, expect } from 'vitest';
import { walkingAnim } from '../animations/walk';
import { JANITOR_ANIMS } from '../animations/janitor';
import { GESTURE_ANIMS } from '../animations/gestures';

describe('3D Animations kinematic output', () => {
  it('walkingAnim produces valid body and limb transformation objects', () => {
    const res = walkingAnim(1.25);
    expect(res).toHaveProperty('body');
    expect(res).toHaveProperty('leftArm');
    expect(res).toHaveProperty('rightArm');
    expect(res).toHaveProperty('leftLeg');
    expect(res).toHaveProperty('rightLeg');
    expect(res.body.rotation).toHaveLength(3);
    expect(res.leftArm.rotation).toHaveLength(3);
  });

  it('JANITOR_ANIMS produces valid props (broom, mop, sponge)', () => {
    const broomRes = JANITOR_ANIMS[0](0.5);
    const mopRes = JANITOR_ANIMS[1](0.5);
    const spongeRes = JANITOR_ANIMS[2](0.5);

    expect(broomRes.prop).toBe('broom');
    expect(mopRes.prop).toBe('mop');
    expect(spongeRes.prop).toBe('sponge');
  });

  it('GESTURE_ANIMS produces valid gesture transformations', () => {
    ['wave', 'cheer', 'facepalm', 'nod', 'thinking'].forEach((gestureName) => {
      const fn = GESTURE_ANIMS[gestureName];
      expect(fn).toBeDefined();
      const res = fn(1.0);
      expect(res.body).toBeDefined();
      expect(res.leftArm).toBeDefined();
      expect(res.rightArm).toBeDefined();
    });
  });
});
