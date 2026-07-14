/**
 * gestures.js — One-shot reaction gestures, keyed by name.
 * /lego module: Played for a short window (agent.gesture + agent.gestureUntil)
 * in sync with the StarCraft SFX bark for the same transition:
 *   wave     — agent spawned (greeting the office)
 *   cheer    — task/cycle success (arms up, little hop)
 *   facepalm — error (hand to face, slow head shake)
 */

function gestureWave(t) {
  // Right arm overhead, wagging side to side
  const wag = Math.sin(t * 7);
  return {
    body: {
      rotation: [0, wag * 0.05, 0.04],
      position: [0, Math.abs(Math.sin(t * 3.5)) * 0.03, 0],
    },
    leftArm: { rotation: [-0.1, 0, 0.15] },
    rightArm: { rotation: [-2.5 + Math.abs(wag) * 0.1, 0, 0.35 + wag * 0.3] },
    leftLeg: { rotation: [0.03, 0, 0] },
    rightLeg: { rotation: [-0.03, 0, 0] },
    prop: null,
  };
}

function gestureCheer(t) {
  // Both arms up, bouncing hop — victory pose
  const hop = Math.abs(Math.sin(t * 5));
  const pump = Math.sin(t * 5);
  return {
    body: {
      rotation: [-0.08, 0, 0],
      position: [0, hop * 0.14, 0],
    },
    leftArm: { rotation: [-2.6 + pump * 0.2, 0.2, 0.3] },
    rightArm: { rotation: [-2.6 - pump * 0.2, -0.2, -0.3] },
    leftLeg: { rotation: [hop * 0.15, 0, 0] },
    rightLeg: { rotation: [-hop * 0.15, 0, 0] },
    prop: null,
  };
}

function gestureFacepalm(t) {
  // Hand pressed to face, head hung, slow disbelieving shake
  const shake = Math.sin(t * 2.5);
  return {
    body: {
      rotation: [0.18, shake * 0.12, 0],
      position: [0, -0.03, 0],
    },
    leftArm: { rotation: [-0.15, 0, 0.05] },
    rightArm: {
      rotation: [-2.35 + Math.sin(t * 9) * 0.03, -0.7, -0.45],
      position: [0.18, 0.55, 0.12],
    },
    leftLeg: { rotation: [0.02, 0, 0] },
    rightLeg: { rotation: [-0.02, 0, 0] },
    prop: null,
  };
}

export const GESTURE_ANIMS = {
  wave: gestureWave,
  cheer: gestureCheer,
  facepalm: gestureFacepalm,
};
