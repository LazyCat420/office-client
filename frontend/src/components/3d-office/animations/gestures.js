/**
 * gestures.js — One-shot reaction & paperwork gestures.
 * /lego module: Played during active events or state notifications.
 */

function gestureWave(t) {
  // Right arm overhead, wagging side to side with natural shoulder roll
  const wag = Math.sin(t * 7);
  return {
    body: {
      rotation: [0.02, wag * 0.06, 0.04],
      position: [0, Math.abs(Math.sin(t * 3.5)) * 0.03, 0],
    },
    leftArm: { rotation: [-0.15, 0.1, 0.15] },
    rightArm: { rotation: [-2.5 + Math.abs(wag) * 0.1, 0.1, 0.35 + wag * 0.35] },
    leftLeg: { rotation: [0.03, 0, 0] },
    rightLeg: { rotation: [-0.03, 0, 0] },
    prop: null,
  };
}

function gestureCheer(t) {
  // Both arms up, bouncing hop — victory pose with fist pump
  const hop = Math.abs(Math.sin(t * 5.5));
  const pump = Math.sin(t * 5.5);
  return {
    body: {
      rotation: [-0.1, 0, 0],
      position: [0, hop * 0.16, 0],
    },
    leftArm: { rotation: [-2.6 + pump * 0.2, 0.2, 0.35] },
    rightArm: { rotation: [-2.6 - pump * 0.2, -0.2, -0.35] },
    leftLeg: { rotation: [hop * 0.18, 0, 0] },
    rightLeg: { rotation: [-hop * 0.18, 0, 0] },
    prop: null,
  };
}

function gestureFacepalm(t) {
  // Hand pressed to face, head hung, slow disbelieving shake
  const shake = Math.sin(t * 2.5);
  return {
    body: {
      rotation: [0.18, shake * 0.14, 0],
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

function gestureNod(t) {
  const nod = Math.sin(t * 6.0);
  return {
    body: {
      rotation: [0.08 + nod * 0.06, 0, 0],
      position: [0, -Math.abs(nod) * 0.02, 0],
    },
    leftArm: { rotation: [-0.3, 0.1, 0.1] },
    rightArm: { rotation: [-0.3, -0.1, -0.1] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: null,
  };
}

function gestureThinking(t) {
  const tilt = Math.sin(t * 1.5);
  return {
    body: {
      rotation: [0.1, tilt * 0.1, 0.05],
      position: [0, 0, 0],
    },
    leftArm: { rotation: [-0.4, 0.2, 0.3] }, // Arm resting across chest
    rightArm: { rotation: [-1.8 + Math.sin(t * 3) * 0.05, -0.5, -0.3] }, // Hand under chin
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: null,
  };
}

function gestureReport(t) {
  const scribble = Math.sin(t * 9);
  const scan = Math.sin(t * 2);
  return {
    body: { rotation: [0.12, scan * 0.05, 0], position: [0, 0, 0] },
    leftArm: { rotation: [-1.1, 0.35, -0.15] },
    rightArm: { rotation: [-1.0 + scribble * 0.12, 0.15 + scribble * 0.18, -0.1] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: 'document',
  };
}

function gestureSeal(t) {
  const press = (Math.sin(t * 4) + 1) / 2;
  return {
    body: { rotation: [0.15 - press * 0.05, 0, 0], position: [0, press * 0.02, 0] },
    leftArm: { rotation: [-1.2 - press * 0.15, 0.5, -0.1] },
    rightArm: { rotation: [-1.2 - press * 0.15, -0.5, 0.1] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: 'envelope',
  };
}

function gesturePresent(t) {
  const offer = Math.sin(t * 3) * 0.1;
  return {
    body: { rotation: [-0.05, 0, 0], position: [0, 0, 0] },
    leftArm: { rotation: [-1.5 + offer, 0.25, -0.1] },
    rightArm: { rotation: [-1.5 + offer, -0.25, 0.1] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: 'document',
  };
}

function gestureListen(t) {
  const nod = Math.sin(t * 2.2);
  return {
    body: { rotation: [0.08 + nod * 0.06, 0, 0], position: [0, 0, 0] },
    leftArm: { rotation: [-0.25, 0.1, 0.12] },
    rightArm: { rotation: [-0.25, -0.1, -0.12] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: null,
  };
}

export const GESTURE_ANIMS = {
  wave: gestureWave,
  cheer: gestureCheer,
  facepalm: gestureFacepalm,
  nod: gestureNod,
  thinking: gestureThinking,
  report: gestureReport,
  seal: gestureSeal,
  present: gesturePresent,
  listen: gestureListen,
};

export const GESTURE_PROPS = {
  report: 'document',
  seal: 'envelope',
  present: 'document',
};

export const GESTURE_DURATIONS = {
  wave: 2500,
  cheer: 2800,
  facepalm: 3000,
  nod: 2000,
  thinking: 3500,
  report: 3600,
  seal: 3000,
  present: 3000,
  listen: 3200,
};
