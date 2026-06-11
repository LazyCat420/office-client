/**
 * walk.js — Walking animation.
 * /lego module: Used when agent state === WALKING.
 */

export function walkingAnim(t) {
  return {
    body: {
      rotation: [0, 0, Math.sin(t * 1.5) * 0.08],
      position: [0, Math.abs(Math.sin(t * 1.5)) * 0.08, 0],
    },
    leftArm: { rotation: [-Math.sin(t * 1.5) * 0.3, 0, -0.15] },
    rightArm: { rotation: [Math.sin(t * 1.5) * 0.3, 0, 0.15] },
    leftLeg: { rotation: [Math.sin(t * 1.5) * 0.4, 0, 0] },
    rightLeg: { rotation: [-Math.sin(t * 1.5) * 0.4, 0, 0] },
    prop: null,
  };
}
