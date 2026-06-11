/**
 * desk.js — Trading Floor animations (5 variants).
 * /lego module: 80s open-outcry pit energy.
 */

function deskYellingBid(t) {
  return {
    body: {
      rotation: [0.3, Math.sin(t * 8) * 0.1, 0],
      position: [0, Math.sin(t * 12) * 0.05, 0],
    },
    leftArm: { rotation: [-2.0, 0.4, -0.2] },
    rightArm: { rotation: [-2.0, -0.4, 0.2] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: null,
  };
}

function deskThrowingTickets(t) {
  const toss = Math.max(0, Math.sin(t * 10));
  return {
    body: {
      rotation: [-0.1 + toss * 0.2, 0, Math.sin(t * 4) * 0.05],
      position: [0, toss * 0.1, 0],
    },
    leftArm: { rotation: [-1.5 - toss * 1.5, 0.2, -0.3] },
    rightArm: { rotation: [-0.5, 0, 0.5] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: 'document',
  };
}

function deskHandSignals(t) {
  const signal1 = Math.sin(t * 15);
  const signal2 = Math.cos(t * 12);
  return {
    body: {
      rotation: [0, signal1 * 0.15, signal2 * 0.05],
      position: [0, 0, 0],
    },
    leftArm: { rotation: [-1.2 + signal1 * 0.3, 0.5, -0.2] },
    rightArm: { rotation: [-1.4 + signal2 * 0.4, -0.5, 0.2] },
    leftLeg: { rotation: [0.1, 0, 0] },
    rightLeg: { rotation: [-0.1, 0, 0] },
    prop: null,
  };
}

function deskJumping(t) {
  const jump = Math.abs(Math.sin(t * 6));
  return {
    body: {
      rotation: [0.2, 0, 0],
      position: [0, jump * 0.4, 0],
    },
    leftArm: { rotation: [-2.5 + jump * 0.5, 0, -0.5] },
    rightArm: { rotation: [-2.5 + jump * 0.5, 0, 0.5] },
    leftLeg: { rotation: [-jump * 0.2, 0, 0] },
    rightLeg: { rotation: [-jump * 0.2, 0, 0] },
    prop: null,
  };
}

/**
 * deskDancing — 80s trading floor celebration dance.
 * Arms pump overhead alternating, hips sway side to side,
 * feet shuffle on the beat, body bounces.
 */
function deskDancing(t) {
  const beat = Math.sin(t * 4);       // main 4Hz beat
  const offbeat = Math.cos(t * 4);
  const doubletime = Math.sin(t * 8); // fast bounce
  return {
    body: {
      rotation: [0.05, beat * 0.25, offbeat * 0.12],
      position: [0, Math.abs(doubletime) * 0.18, 0],
    },
    leftArm: { rotation: [-2.3 + beat * 0.6, 0.3 + offbeat * 0.2, -0.4] },
    rightArm: { rotation: [-2.3 - beat * 0.6, -0.3 - offbeat * 0.2, 0.4] },
    leftLeg: { rotation: [beat * 0.35, 0, -0.12 + offbeat * 0.08] },
    rightLeg: { rotation: [-beat * 0.35, 0, 0.12 - offbeat * 0.08] },
    prop: null,
  };
}

export const DESK_ANIMS = [
  deskYellingBid,
  deskThrowingTickets,
  deskHandSignals,
  deskJumping,
  deskDancing,
];
