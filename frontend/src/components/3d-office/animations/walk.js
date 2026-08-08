/**
 * walk.js — Biomechanically enhanced walking gait cycle.
 * /lego module: Used when agent state === WALKING.
 */

export function walkingAnim(t) {
  const strideFreq = 7.5;
  const stride = Math.sin(t * strideFreq);
  const doubleStride = Math.sin(t * strideFreq * 2);
  const bounce = Math.abs(Math.sin(t * strideFreq)) * 0.06;

  // Knee flex when lifting leg forward
  const leftLegBend = Math.max(0, stride) * 0.2;
  const rightLegBend = Math.max(0, -stride) * 0.2;

  return {
    body: {
      rotation: [0.03, stride * 0.08, Math.sin(t * strideFreq * 0.5) * 0.04],
      position: [0, bounce, 0],
    },
    leftArm: { rotation: [-stride * 0.45, 0.05, -0.15] },
    rightArm: { rotation: [stride * 0.45, -0.05, 0.15] },
    leftLeg: { rotation: [stride * 0.48 + leftLegBend, 0, 0] },
    rightLeg: { rotation: [-stride * 0.48 + rightLegBend, 0, 0] },
    prop: null,
  };
}
