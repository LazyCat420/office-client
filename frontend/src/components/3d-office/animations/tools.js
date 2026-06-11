/**
 * tools.js — Trading Tools animations (3 variants).
 * /lego module: Hammering, terminal typing, pulling levers.
 */

function toolsHammering(t) {
  const strike = Math.max(0, Math.sin(t * 6));
  return {
    body: {
      rotation: [0.1 + strike * 0.08, 0, 0],
      position: [0, strike * 0.04, 0],
    },
    leftArm: { rotation: [-0.5, 0, -0.4] },
    rightArm: { rotation: [-1.5 + strike * 0.8, 0, 0.3] },
    leftLeg: { rotation: [0, 0, -0.15] },
    rightLeg: { rotation: [0, 0, 0.15] },
    prop: 'hammer',
  };
}

function toolsTerminal(t) {
  return {
    body: {
      rotation: [0.12, 0, 0],
      position: [0, 0, 0],
    },
    leftArm: { rotation: [-1.1, Math.sin(t * 20) * 0.12 + 0.15, -0.15] },
    rightArm: { rotation: [-1.1, -(Math.cos(t * 20) * 0.12 + 0.15), 0.15] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: null,
  };
}

function toolsLevers(t) {
  const pull = Math.sin(t * 3);
  return {
    body: {
      rotation: [pull * 0.05, 0, 0],
      position: [0, 0, 0],
    },
    leftArm: { rotation: [-2.0 + pull * 0.6, 0, -0.3] },
    rightArm: { rotation: [-2.0 - pull * 0.6, 0, 0.3] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: null,
  };
}

export const TOOLS_ANIMS = [toolsHammering, toolsTerminal, toolsLevers];
