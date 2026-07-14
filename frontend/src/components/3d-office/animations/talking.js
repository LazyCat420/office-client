/**
 * talking.js — Speech gesture animations (3 variants).
 * /lego module: Played while an agent's TTS voice line is active
 * (agent.isSpeaking), regardless of station. Hands stay free (prop: null)
 * so the agent visibly "talks with their hands".
 */

function talkExplain(t) {
  // Alternating open-palm gestures, like walking a colleague through a chart
  const beat = Math.sin(t * 3.2);
  const offBeat = Math.sin(t * 3.2 + Math.PI);
  return {
    body: {
      rotation: [0.04 + Math.sin(t * 6.5) * 0.03, Math.sin(t * 1.4) * 0.12, 0],
      position: [0, Math.abs(Math.sin(t * 3.2)) * 0.02, 0],
    },
    leftArm: { rotation: [-0.7 + beat * 0.35, 0.25, 0.5 + beat * 0.15] },
    rightArm: { rotation: [-0.7 + offBeat * 0.35, -0.25, -0.5 - offBeat * 0.15] },
    leftLeg: { rotation: [0.04, 0, 0] },
    rightLeg: { rotation: [-0.04, 0, 0] },
    prop: null,
  };
}

function talkEmphatic(t) {
  // Both hands punctuating each phrase — the table-pounding pitch
  const pulse = Math.max(0, Math.sin(t * 4.5));
  return {
    body: {
      rotation: [0.08 + pulse * 0.06, Math.sin(t * 0.9) * 0.08, 0],
      position: [0, pulse * 0.04, 0],
    },
    leftArm: { rotation: [-1.0 - pulse * 0.5, 0.3, 0.35] },
    rightArm: { rotation: [-1.0 - pulse * 0.5, -0.3, -0.35] },
    leftLeg: { rotation: [pulse * 0.06, 0, 0] },
    rightLeg: { rotation: [-pulse * 0.06, 0, 0] },
    prop: null,
  };
}

function talkPresent(t) {
  // One arm sweeping wide (presenting the big picture), other hand on hip
  const sweep = Math.sin(t * 1.8);
  return {
    body: {
      rotation: [0.05, sweep * 0.22, Math.sin(t * 6) * 0.015],
      position: [0, 0, 0],
    },
    leftArm: { rotation: [0.35, 0, 0.85] }, // hand on hip
    rightArm: { rotation: [-1.35 + Math.sin(t * 5.5) * 0.1, -0.4 + sweep * 0.5, -0.45] },
    leftLeg: { rotation: [0.05, 0, 0] },
    rightLeg: { rotation: [-0.05, 0, 0] },
    prop: null,
  };
}

export const TALKING_ANIMS = [talkExplain, talkEmphatic, talkPresent];
