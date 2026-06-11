/**
 * throwing.js — Research Desk / Throwing Paperwork animations (4 variants).
 * /lego module: Overhand, frisbee, underhand, and two-handed document throwing.
 */

// Helper to determine the throw phase (0.0 to 1.0)
// Release happens at phase = 0.55
function getThrowPhase(t, period = 3.0) {
  return (t % period) / period;
}

function throwingRightArmOverhand(t) {
  const phase = getThrowPhase(t, 2.5);
  let armX = -0.4;
  let armY = -0.15;
  let armZ = 0.2;
  let prop = null;
  let bodyRotX = 0;

  if (phase < 0.4) {
    // 1. Prepare/Lift arm: phase 0.0 -> 0.4
    const p = phase / 0.4;
    armX = -0.4 - p * 2.1; // goes to -2.5
    armY = -0.15 - p * 0.35; // inward twist
    armZ = 0.2 + p * 0.1;
    prop = 'document';
    bodyRotX = p * 0.15; // lean back
  } else if (phase < 0.55) {
    // 2. Snap forward (the throw): phase 0.4 -> 0.55
    const p = (phase - 0.4) / 0.15;
    armX = -2.5 + p * 2.0; // goes to -0.5
    armY = -0.5 + p * 0.5;
    armZ = 0.3 - p * 0.2;
    prop = p < 0.5 ? 'document' : null; // release halfway through snap
    bodyRotX = 0.15 - p * 0.3; // lean forward
  } else {
    // 3. Reset: phase 0.55 -> 1.0
    const p = (phase - 0.55) / 0.45;
    armX = -0.5 + p * 0.1;
    armY = 0;
    armZ = 0.1 + p * 0.1;
    prop = null;
    bodyRotX = -0.15 + p * 0.15;
  }

  return {
    body: {
      rotation: [bodyRotX, 0, 0],
      position: [0, 0.25, 0],
    },
    leftArm: { rotation: [-0.4, 0.15, -0.2] }, // resting
    rightArm: { rotation: [armX, armY, armZ] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop,
  };
}

function throwingLeftArmFrisbee(t) {
  const phase = getThrowPhase(t, 2.8);
  let armX = -0.4;
  let armY = 0.15;
  let armZ = -0.2;
  let prop = null;
  let bodyRotY = 0;

  if (phase < 0.4) {
    // Bring left arm across chest
    const p = phase / 0.4;
    armX = -0.4 - p * 0.8;
    armY = 0.15 + p * 0.8; // twist right
    armZ = -0.2 + p * 0.6; // swing right
    prop = 'document';
    bodyRotY = -p * 0.3; // rotate body left
  } else if (phase < 0.55) {
    // Whip arm outward
    const p = (phase - 0.4) / 0.15;
    armX = -1.2 + p * 0.6;
    armY = 0.95 - p * 1.5; // whip left
    armZ = 0.4 - p * 0.9;  // swing left
    prop = p < 0.4 ? 'document' : null; // release
    bodyRotY = -0.3 + p * 0.6; // rotate body right
  } else {
    // Reset
    const p = (phase - 0.55) / 0.45;
    armX = -0.6 + p * 0.2;
    armY = -0.55 + p * 0.7;
    armZ = -0.5 + p * 0.3;
    prop = null;
    bodyRotY = 0.3 - p * 0.3;
  }

  return {
    body: {
      rotation: [0, bodyRotY, 0],
      position: [0, 0.25, 0],
    },
    leftArm: { rotation: [armX, armY, armZ] },
    rightArm: { rotation: [-0.4, -0.15, 0.2] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop,
  };
}

function throwingRightArmUnderhand(t) {
  const phase = getThrowPhase(t, 2.3);
  let armX = -0.4;
  let armY = -0.15;
  let armZ = 0.2;
  let prop = null;
  let bodyRotX = 0;

  if (phase < 0.4) {
    // Swing arm back
    const p = phase / 0.4;
    armX = -0.4 + p * 0.9; // goes to 0.5
    armY = -0.15 - p * 0.1;
    armZ = 0.2 + p * 0.15;
    prop = 'document';
    bodyRotX = p * 0.1;
  } else if (phase < 0.55) {
    // Flick forward
    const p = (phase - 0.4) / 0.15;
    armX = 0.5 - p * 2.3; // goes to -1.8
    armY = -0.25 + p * 0.4;
    armZ = 0.35 - p * 0.25;
    prop = p < 0.6 ? 'document' : null;
    bodyRotX = 0.1 - p * 0.2;
  } else {
    // Reset
    const p = (phase - 0.55) / 0.45;
    armX = -1.8 + p * 1.4;
    armY = 0.15 - p * 0.3;
    armZ = 0.1 + p * 0.1;
    prop = null;
    bodyRotX = -0.1 + p * 0.1;
  }

  return {
    body: {
      rotation: [bodyRotX, 0, 0],
      position: [0, 0.25, 0],
    },
    leftArm: { rotation: [-0.4, 0.15, -0.2] },
    rightArm: { rotation: [armX, armY, armZ] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop,
  };
}

function throwingTwoHanded(t) {
  const phase = getThrowPhase(t, 3.2);
  let armX = -0.4;
  let armY = 0;
  let prop = null;
  let bodyRotX = 0;

  if (phase < 0.4) {
    // Raise both arms overhead
    const p = phase / 0.4;
    armX = -0.4 - p * 2.3; // goes to -2.7
    prop = 'document';
    bodyRotX = p * 0.15;
  } else if (phase < 0.55) {
    // Snap both forward
    const p = (phase - 0.4) / 0.15;
    armX = -2.7 + p * 2.1; // goes to -0.6
    prop = p < 0.5 ? 'document' : null;
    bodyRotX = 0.15 - p * 0.35;
  } else {
    // Reset
    const p = (phase - 0.55) / 0.45;
    armX = -0.6 + p * 0.2;
    prop = null;
    bodyRotX = -0.2 + p * 0.2;
  }

  return {
    body: {
      rotation: [bodyRotX, 0, 0],
      position: [0, 0.25, 0],
    },
    leftArm: { rotation: [armX, 0.25, -0.2] },
    rightArm: { rotation: [armX, -0.25, 0.2] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop,
  };
}

export const THROWING_ANIMS = [
  throwingRightArmOverhand,
  throwingLeftArmFrisbee,
  throwingRightArmUnderhand,
  throwingTwoHanded,
];
