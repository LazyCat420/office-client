/**
 * exec.js — Exec Office animations (3 variants).
 * /lego module: Boss lean, signing documents, phone call.
 */

function execBossLean(t) {
  return {
    body: {
      rotation: [-0.15, 0, Math.sin(t * 1) * 0.03],
      position: [0, 0, 0],
    },
    leftArm: { rotation: [-0.3, 0.5, -0.8] },
    rightArm: { rotation: [-0.3, -0.5, 0.8] },
    leftLeg: { rotation: [0.5, 0, -0.2] },
    rightLeg: { rotation: [0.3, 0.3, 0.1] },
    prop: null,
  };
}

function execSigning(t) {
  const scribble = Math.sin(t * 12) * 0.08;
  return {
    body: {
      rotation: [0.15, 0, 0],
      position: [0, 0, 0],
    },
    leftArm: { rotation: [-0.9, 0.2, -0.3] },
    rightArm: { rotation: [-1.0, -0.1 + scribble, 0.2] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: 'document',
  };
}

function execPhoneCall(t) {
  const pace = Math.sin(t * 1.5);
  return {
    body: {
      rotation: [0, pace * 0.25, Math.sin(t * 2) * 0.04],
      position: [0, Math.abs(Math.sin(t * 3)) * 0.04, 0],
    },
    leftArm: { rotation: [-Math.sin(t * 2) * 0.2, 0, -0.15] },
    rightArm: { rotation: [-2.2, -0.5, 0.6] },
    leftLeg: { rotation: [Math.sin(t * 3) * 0.2, 0, 0] },
    rightLeg: { rotation: [-Math.sin(t * 3) * 0.2, 0, 0] },
    prop: 'phone',
  };
}

export const EXEC_ANIMS = [execBossLean, execSigning, execPhoneCall];
