/**
 * lobby.js — Lobby idle animation (1 variant).
 * /lego module: Gentle breathing while waiting.
 */

function lobbyIdle(t) {
  const breathe = Math.sin(t * 3) * 0.02;
  return {
    body: {
      rotation: [0, 0, 0],
      position: [0, 0, 0],
    },
    leftArm: { rotation: [0, 0, -0.1 - breathe] },
    rightArm: { rotation: [0, 0, 0.1 + breathe] },
    leftLeg: { rotation: [0, 0, 0] },
    rightLeg: { rotation: [0, 0, 0] },
    prop: null,
  };
}

export const LOBBY_ANIMS = [lobbyIdle];
