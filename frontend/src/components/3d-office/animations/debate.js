/**
 * debate.js — War Room animations (3 variants).
 * /lego module: Gesturing, table slamming, pacing.
 */

function debateThrust(t) {
  // Lunge forward and thrust sword
  const lunge = Math.max(0, Math.sin(t * 4));
  return {
    body: {
      rotation: [0.1 + lunge * 0.2, Math.sin(t * 2) * 0.1, 0],
      position: [0, 0, lunge * 0.3],
    },
    leftArm: { rotation: [0.8 - lunge * 0.2, -0.3, -0.8] },
    // Right arm extending forward for a thrust
    rightArm: { rotation: [-1.2 - lunge * 0.8, 0.2, -0.2] },
    leftLeg: { rotation: [lunge * 0.3, 0, 0] },
    rightLeg: { rotation: [-lunge * 0.3, 0, 0] },
    prop: 'sword',
  };
}

function debateSwing(t) {
  // Broad overhead or side swing
  const swingPhase = Math.sin(t * 3);
  return {
    body: {
      rotation: [0.1 + swingPhase * 0.2, Math.cos(t * 1.5) * 0.2, 0],
      position: [0, Math.abs(swingPhase) * 0.06, swingPhase * 0.1],
    },
    leftArm: { rotation: [-0.6 - swingPhase * 0.4, 0.2, -0.3] },
    // Right arm winding up and swinging down
    rightArm: { rotation: [-2.0 + swingPhase * 1.2, -0.4 + swingPhase * 0.4, 0] },
    leftLeg: { rotation: [swingPhase * 0.25, 0, 0] },
    rightLeg: { rotation: [-swingPhase * 0.25, 0, 0] },
    prop: 'sword',
  };
}

function debateParry(t) {
  // Defensive stance, stepping back or side-to-side slightly
  const shift = Math.sin(t * 2.5);
  return {
    body: {
      rotation: [0.05, shift * 0.3, 0],
      position: [shift * 0.15, 0, -Math.abs(shift) * 0.1],
    },
    leftArm: { rotation: [-0.4, 0, -0.4] },
    // Right arm up and across body to block
    rightArm: { rotation: [-1.5 + Math.sin(t * 5) * 0.2, 0.8 + Math.cos(t * 5) * 0.2, -0.5] },
    leftLeg: { rotation: [Math.sin(t * 5) * 0.2, 0, 0] },
    rightLeg: { rotation: [-Math.sin(t * 5) * 0.2, 0, 0] },
    prop: 'sword',
  };
}

export const DEBATE_ANIMS = [debateThrust, debateSwing, debateParry];
