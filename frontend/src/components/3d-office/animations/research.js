/**
 * research.js — Research Desk animations (4 variants).
 * /lego module: Papers, charts, books, magnifying glass.
 */

function researchShufflingPapers(t) {
  const pickCycle = Math.sin(t * 3);
  const liftPhase = Math.max(0, pickCycle);
  return {
    body: {
      rotation: [0.2, pickCycle * 0.12, 0],
      position: [0, 0.25, 0],
    },
    leftArm: { rotation: [-1.4 - liftPhase * 0.3, 0.15 + pickCycle * 0.1, -0.25] },
    rightArm: { rotation: [-1.3 - liftPhase * 0.5, -0.15, 0.2 + liftPhase * 0.15] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: 'document',
  };
}

function researchComparingCharts(t) {
  const lookSide = Math.sin(t * 1.8);
  const headTilt = Math.sin(t * 3.5) * 0.05;
  return {
    body: {
      rotation: [0.15, lookSide * 0.35, headTilt],
      position: [0, 0.25, 0],
    },
    leftArm: { rotation: [-1.4, 0.4, -0.3] },
    rightArm: { rotation: [-1.4, -0.4, 0.3] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [lookSide * 0.08, 0, 0] },
    prop: 'document',
  };
}

function researchFlippingBook(t) {
  const flipSpeed = Math.sin(t * 6) * 0.2;
  const pageGrab = Math.max(0, Math.sin(t * 4));
  return {
    body: {
      rotation: [0.25, 0, Math.sin(t * 2) * 0.03],
      position: [0, 0.25, 0],
    },
    leftArm: { rotation: [-1.5, 0.2, -0.3] },
    rightArm: { rotation: [-1.4 - pageGrab * 0.3, -0.1 + flipSpeed, 0.2] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: 'document',
  };
}

function researchScanningDoc(t) {
  const scanX = Math.sin(t * 1.2) * 0.15;
  const scanZ = Math.sin(t * 0.8) * 0.08;
  return {
    body: {
      rotation: [0.3, scanX, 0],
      position: [0, 0.25, scanZ],
    },
    leftArm: { rotation: [-1.4, 0.2 + scanX, -0.2] },
    rightArm: { rotation: [-1.6, -0.1 + Math.sin(t * 3) * 0.1, 0.15] },
    leftLeg: { rotation: [Math.sin(t * 1.2) * 0.1, 0, 0] },
    rightLeg: { rotation: [-Math.sin(t * 1.2) * 0.1, 0, 0] },
    prop: 'magnifyingGlass',
  };
}

function researchWritingWhiteboard(t) {
  const writeX = Math.sin(t * 5) * 0.15;
  const writeY = Math.cos(t * 3) * 0.15;
  return {
    body: {
      rotation: [0.05, 0.4 + writeX * 0.1, 0], // turned toward whiteboard
      position: [0, 0.25, 0],
    },
    leftArm: { rotation: [-1.2, 0, -0.2] }, // resting on desk
    rightArm: { rotation: [-1.8 + writeY, -0.2 + writeX, 0.5] }, // raised, writing
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: null, // writing on whiteboard, no prop needed
  };
}

function researchWritingOnPaper(t) {
  const writeX = Math.sin(t * 5) * 0.15;
  const writeY = Math.cos(t * 3) * 0.15;
  return {
    body: {
      rotation: [0.05, writeX * 0.1, 0], // facing forward
      position: [0, 0.25, 0],
    },
    leftArm: { rotation: [-1.2, 0, -0.2] }, // resting on desk
    rightArm: { rotation: [-1.8 + writeY, writeX, 0.5] }, // writing on paper
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: 'document', // writing on paper, uses document prop
  };
}

function researchTypingKeyboard(t) {
  const typeLeft = Math.sin(t * 15) * 0.08;
  const typeRight = Math.cos(t * 18) * 0.08;
  const doubleTime = Math.sin(t * 10) * 0.02;
  return {
    body: {
      rotation: [0.15, 0, doubleTime],
      position: [0, 0.25, 0],
    },
    leftArm: { rotation: [-1.5 + typeLeft, 0.2, -0.1] },
    rightArm: { rotation: [-1.5 + typeRight, -0.2, 0.1] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: null, // typing on keyboard, hands in front
  };
}

function researchTalking(t) {
  const sway = Math.sin(t * 2.5);
  const gesture = Math.cos(t * 4) * 0.25;
  return {
    body: {
      rotation: [0.02, sway * 0.15, 0],
      position: [0, 0.25, 0],
    },
    leftArm: { rotation: [-1.3 + gesture, 0.2, -0.25] }, // gesturing over desk
    rightArm: { rotation: [-1.3, -0.15, 0.2] },
    leftLeg: { rotation: [sway * 0.05, 0, 0] },
    rightLeg: { rotation: [-sway * 0.05, 0, 0] },
    prop: null,
  };
}

function researchThrowingPapers(t) {
  // Cycle repeats every roughly 3 seconds
  // Phase 0: Reach down (0 - 1s)
  // Phase 1: Lift up (1s - 2s)
  // Phase 2: Throw (2s - 2.5s)
  // Phase 3: Recover (2.5s - 3s)
  const cycle = (t * 0.33) % 1;
  
  let rightArmX = -1.4;
  let rightArmY = -0.2;
  let rightArmZ = 0.2;
  let prop = null;
  
  if (cycle < 0.3) {
    // Reaching down to desk
    const prog = cycle / 0.3;
    rightArmX = -1.0 + prog * -0.5; // reaches down to -1.5
    prop = null;
  } else if (cycle < 0.6) {
    // Lifting paper up
    const prog = (cycle - 0.3) / 0.3;
    rightArmX = -1.5 + prog * 1.5; // lifts up to 0 (straight forward)
    rightArmY = -0.2 + prog * 0.5; // swings arm out slightly
    prop = 'document';
  } else if (cycle < 0.7) {
    // Throwing! Arm snaps forward/down
    const prog = (cycle - 0.6) / 0.1;
    rightArmX = 0 - prog * 1.8; // snaps down to -1.8
    rightArmY = 0.3 - prog * 0.5; // cross body
    prop = null; // Released
  } else {
    // Recovering to idle
    const prog = (cycle - 0.7) / 0.3;
    rightArmX = -1.8 + prog * 0.4; // back to resting -1.4
    rightArmY = -0.2;
    prop = null;
  }

  return {
    body: {
      rotation: [0.1, Math.sin(t * 3) * 0.1, 0],
      position: [0, 0.25, 0],
    },
    leftArm: { rotation: [-1.4, 0.2, -0.2] }, // resting on desk
    rightArm: { rotation: [rightArmX, rightArmY, rightArmZ] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop,
  };
}

export const RESEARCH_ANIMS = [
  researchShufflingPapers,
  researchComparingCharts,
  researchFlippingBook,
  researchScanningDoc,
  researchWritingWhiteboard,
  researchWritingOnPaper,
  researchTypingKeyboard,
  researchTalking,
  researchThrowingPapers,
];
