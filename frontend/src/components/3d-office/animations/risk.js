/**
 * risk.js — Risk Management animations (3 variants).
 * /lego module: Panic, stressed, methodical.
 */

function riskPanic(t) {
  return {
    body: {
      rotation: [0, 0, Math.sin(t * 8) * 0.15],
      position: [0, Math.abs(Math.sin(t * 10)) * 0.08, 0],
    },
    leftArm: { rotation: [-1.0 + Math.sin(t * 9) * 0.6, Math.sin(t * 7) * 0.4, -0.5] },
    rightArm: { rotation: [-1.0 - Math.sin(t * 9) * 0.6, -Math.sin(t * 7) * 0.4, 0.5] },
    leftLeg: { rotation: [Math.sin(t * 10) * 0.5, 0, 0] },
    rightLeg: { rotation: [-Math.sin(t * 10) * 0.5, 0, 0] },
    prop: null,
  };
}

function riskStressed(t) {
  const breathe = Math.sin(t * 2) * 0.03;
  return {
    body: {
      rotation: [0.2, 0, breathe],
      position: [0, 0, 0],
    },
    leftArm: { rotation: [-2.0, 0.5, -0.4] },
    rightArm: { rotation: [-2.0, -0.5, 0.4] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: null,
  };
}

function riskMethodical(t) {
  return {
    body: {
      rotation: [0.1, 0, 0],
      position: [0, 0, 0],
    },
    leftArm: { rotation: [-0.8, 0.2 + Math.sin(t * 2) * 0.1, -0.2] },
    rightArm: { rotation: [-1.0, -0.1, 0.2 + Math.sin(t * 4) * 0.08] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: null,
  };
}

export const RISK_ANIMS = [riskPanic, riskStressed, riskMethodical];
