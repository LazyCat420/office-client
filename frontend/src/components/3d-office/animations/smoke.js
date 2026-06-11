/**
 * smoke.js — Break Room animations (5 variants).
 * /lego module: Relaxed cigar poses, pacing, chatting, leaning.
 * Each agent gets a different variant based on their ID hash.
 *
 * All variants feature a periodic "take a drag" motion where the
 * right arm lifts the cigarette to mouth height.
 * 
 * Mathematically solved optimal angles to touch the mouth ([-0.45, 0.05, 0.38] relative to joint):
 * rx = -1.92, ry = -0.78, rz = 0.48
 */

// ── Shared drag-cycle helper ──
// Returns 0→1→0 smoothstep for a drag that lasts ~1.5s every `period` seconds
function dragCycle(t, period, offset) {
  const phase = ((t + offset) % period) / period;
  // Drag window: 0.0–0.3 of the period
  if (phase < 0.1) {
    // Lifting to mouth
    return phase / 0.1;
  } else if (phase < 0.2) {
    // Holding at mouth (inhaling)
    return 1.0;
  } else if (phase < 0.3) {
    // Lowering back down
    return 1.0 - (phase - 0.2) / 0.1;
  }
  return 0;
}

// Variant 0: Relaxed lean back, periodic drag to mouth
function smokeRelax(t) {
  const drag = dragCycle(t, 7.0, 0);
  const breathe = Math.sin(t * 2) * 0.02;
  // Optimized mouth target: rx=1.18, ry=-0.52, rz=-2.48
  const armX = -0.4 + drag * 1.58;
  const armY = -drag * 0.52;
  const armZ = 0.15 - drag * 2.63;
  return {
    body: {
      rotation: [-0.08 - drag * 0.05, drag * 0.08, Math.sin(t * 1) * 0.03],
      position: [0, 0, 0],
    },
    leftArm: { rotation: [0, 0, -0.2 - breathe] },
    rightArm: { 
      rotation: [armX, armY, armZ],
      position: [0.45 - drag * 0.25, 0.5, drag * 0.15]
    },
    leftLeg: { rotation: [0.2, 0, -0.1] },
    rightLeg: { rotation: [0.1, 0.1, 0.05] },
    prop: 'cigarette',
  };
}

// Variant 1: Pacing slowly, pauses to take a drag
function smokePacing(t) {
  const drag = dragCycle(t, 8.0, 1.5);
  const paceSpeed = drag > 0.5 ? 0.3 : 1.0; // slow down when dragging
  const pace = Math.sin(t * 1.2 * paceSpeed);
  const step = Math.sin(t * 2.4 * paceSpeed);
  // Optimized mouth target: rx=1.18, ry=-0.52, rz=-2.48
  const armX = -0.3 + drag * 1.48;
  const armY = -drag * 0.52;
  const armZ = -0.25 - drag * 2.23;
  return {
    body: {
      rotation: [0.03, pace * 0.4 * (1 - drag * 0.7), 0],
      position: [0, Math.abs(step) * 0.03 * (1 - drag), pace * 0.3 * (1 - drag * 0.5)],
    },
    leftArm: { rotation: [0.25 * (1 - drag * 0.5), 0, 0.25] },
    rightArm: { 
      rotation: [armX, armY, armZ],
      position: [0.45 - drag * 0.25, 0.5, drag * 0.15]
    },
    leftLeg: { rotation: [step * 0.25 * (1 - drag * 0.6), 0, 0] },
    rightLeg: { rotation: [-step * 0.25 * (1 - drag * 0.6), 0, 0] },
    prop: 'cigarette',
  };
}

// Variant 2: Hold cigarette out, inspect it, bring to mouth to taste
function smokeInspect(t) {
  const cycle = (t * 0.4) % (Math.PI * 2);
  const holdOut = Math.max(0, Math.sin(cycle));    // arm extends to inspect
  const bringBack = Math.max(0, -Math.sin(cycle)); // arm returns to mouth
  const mouthLift = bringBack;
  // Optimized mouth target: rx=1.18, ry=-0.52, rz=-2.48
  const armX = -0.8 - holdOut * 0.7 + mouthLift * 1.98;
  const armY = -mouthLift * 0.52;
  const armZ = 0.15 + holdOut * 0.1 - mouthLift * 2.63;
  return {
    body: {
      rotation: [0.05 + holdOut * 0.1 - mouthLift * 0.05, holdOut * 0.15 + mouthLift * 0.1, 0],
      position: [0, 0, 0],
    },
    leftArm: { rotation: [-0.3, 0.1, -0.15] },
    rightArm: { 
      rotation: [armX, armY, armZ],
      position: [0.45 - mouthLift * 0.25, 0.5, mouthLift * 0.15]
    },
    leftLeg: { rotation: [0.15, 0, -0.08] },
    rightLeg: { rotation: [0.05, 0.05, 0.05] },
    prop: 'cigarette',
  };
}

// Variant 3: Lean against wall, one arm crossed, periodic drag
function smokeLeaning(t) {
  const drag = dragCycle(t, 9.0, 3.0);
  const breathe = Math.sin(t * 2) * 0.02;
  const headTurn = Math.sin(t * 0.7) * 0.2;
  // Optimized mouth target: rx=1.18, ry=-0.52, rz=-2.48
  const armX = -0.6 + drag * 1.78;
  const armY = -drag * 0.52;
  const armZ = 0.5 - drag * 2.98;
  return {
    body: {
      rotation: [-0.12, headTurn * (1 - drag * 0.5), 0.08],
      position: [0, 0, 0],
    },
    leftArm: { rotation: [-0.6, 0.5, -0.7] },
    rightArm: { 
      rotation: [armX, armY, armZ],
      position: [0.45 - drag * 0.25, 0.5, drag * 0.15]
    },
    leftLeg: { rotation: [0.4, 0, -0.15] },
    rightLeg: { rotation: [0.05, 0, 0.05] },
    prop: 'cigarette',
  };
}

// Variant 4: Chatting — gesturing with left hand, right hand drags cigarette between words
function smokeChatting(t) {
  const drag = dragCycle(t, 6.0, 2.0);
  const turn = Math.sin(t * 1.0) * (1 - drag * 0.6);
  const gesture = Math.sin(t * 2.5);
  // Optimized mouth target: rx=1.18, ry=-0.52, rz=-2.48
  const armX = -0.4 + drag * 1.58;
  const armY = -drag * 0.52;
  const armZ = 0.15 - drag * 2.63;
  return {
    body: {
      rotation: [0.03, turn * 0.35, 0],
      position: [0, 0, 0],
    },
    leftArm: { rotation: [-0.7 + gesture * 0.25 * (1 - drag * 0.3), 0.3, -0.3] },
    rightArm: { 
      rotation: [armX, armY, armZ],
      position: [0.45 - drag * 0.25, 0.5, drag * 0.15]
    },
    leftLeg: { rotation: [Math.sin(t * 1.5) * 0.08, 0, 0] },
    rightLeg: { rotation: [-Math.sin(t * 1.5) * 0.08, 0, 0] },
    prop: 'cigarette',
  };
}

export const SMOKE_ANIMS = [smokeRelax, smokePacing, smokeInspect, smokeLeaning, smokeChatting];
