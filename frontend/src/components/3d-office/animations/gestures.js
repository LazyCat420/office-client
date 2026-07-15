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

// ── Report / paperwork gestures ──
// Triggered off the backend's structured events (agent_done → report/seal,
// report hand-off → present). Unlike the reaction gestures above, these keep a
// document/envelope in hand (see GESTURE_PROPS + the prop memo in
// useAnimationLoop). Looping motions — the write→seal→deliver narrative comes
// from triggering different gestures across events, not from one sequence.

function gestureReport(t) {
  // Writing a report: document held up in the left hand, right hand scribbles.
  const scribble = Math.sin(t * 9);
  const scan = Math.sin(t * 2);
  return {
    body: { rotation: [0.12, scan * 0.05, 0], position: [0, 0, 0] },
    leftArm: { rotation: [-1.1, 0.35, -0.15] },       // holds the page up
    rightArm: { rotation: [-1.0 + scribble * 0.12, 0.15 + scribble * 0.18, -0.1] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: 'document',
  };
}

function gestureSeal(t) {
  // Sealing an envelope: both hands meet at center and press the flap down.
  const press = (Math.sin(t * 4) + 1) / 2; // 0..1
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
  // Presenting / handing off a document — both arms extended forward, offer bob.
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
  // Listening to a colleague — hands clasped low, slow attentive nod.
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
  report: gestureReport,
  seal: gestureSeal,
  present: gesturePresent,
  listen: gestureListen,
};

// Gestures that keep a prop welded to the hand. The prop memo frees the hands
// for every other gesture (wave/cheer/facepalm) and while speaking.
export const GESTURE_PROPS = {
  report: 'document',
  seal: 'envelope',
  present: 'document',
};

// Per-gesture display durations (ms). Reaction barks are quick; paperwork reads
// better held a little longer. Falls back to the caller's default when absent.
export const GESTURE_DURATIONS = {
  report: 3600,
  seal: 3000,
  present: 3000,
  listen: 3200,
};
