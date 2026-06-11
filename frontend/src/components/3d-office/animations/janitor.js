export const JANITOR_ANIMS = [
  (t) => {
    // Sweeping animation:
    // Arms sweep left to right using a sine wave
    // Body bends slightly forward and bobs
    const sweep = Math.sin(t * 3.0);
    const bob = Math.abs(Math.sin(t * 6.0)) * 0.05;
    return {
      prop: 'broom',
      body: { position: [0, -0.05 + bob, 0], rotation: [0.15, sweep * 0.2, 0] },
      leftArm: { rotation: [0.3, sweep * 0.5 + 0.2, 0] },
      rightArm: { rotation: [0.3, sweep * 0.5 - 0.2, 0] },
      leftLeg: { rotation: [0, 0, 0] },
      rightLeg: { rotation: [0, 0, 0] }
    };
  },
  (t) => {
    // Mopping animation:
    // Pushing mop forward and back
    const push = Math.sin(t * 2.5);
    const lean = push * 0.1;
    return {
      prop: 'mop',
      body: { position: [0, -0.05 + Math.abs(lean), push * 0.1], rotation: [0.2 + lean, 0, 0] },
      leftArm: { rotation: [0.5 + push * 0.3, 0.1, 0] },
      rightArm: { rotation: [0.5 + push * 0.3, -0.1, 0] },
      leftLeg: { rotation: [0, 0, 0] },
      rightLeg: { rotation: [0, 0, 0] }
    };
  },
  (t) => {
    // Cleaning windows animation:
    // One arm making circles high up, body stretched up
    const circleX = Math.cos(t * 4.0);
    const circleY = Math.sin(t * 4.0);
    return {
      prop: 'sponge',
      body: { position: [0, 0.05, 0], rotation: [-0.1, circleX * 0.1, 0] },
      leftArm: { rotation: [0, 0, 0] }, // resting
      rightArm: { rotation: [-2.5 + circleY * 0.3, 0, circleX * 0.3] }, // hand up, circular motion
      leftLeg: { rotation: [0, 0, 0] },
      rightLeg: { rotation: [0, 0, 0] }
    };
  }
];
