/**
 * janitor.js — Janitor station animations (3 variants: sweeping, mopping, window cleaning).
 * /lego module: Smooth sweeping arcs, mop dipping/wringing, window cleaning.
 */

export const JANITOR_ANIMS = [
  (t) => {
    // Sweeping animation:
    // Torso leans and sways smoothly; arms hold broom handle and sweep in wide arcs.
    const sweep = Math.sin(t * 2.8);
    const bob = Math.abs(Math.sin(t * 5.6)) * 0.04;
    return {
      prop: 'broom',
      body: {
        position: [0, -0.04 + bob, sweep * 0.05],
        rotation: [0.12, sweep * 0.25, Math.cos(t * 2.8) * 0.03],
      },
      leftArm: { rotation: [0.35, sweep * 0.45 + 0.15, -0.1] },
      rightArm: { rotation: [0.35, sweep * 0.45 - 0.15, 0.1] },
      leftLeg: { rotation: [sweep * 0.1, 0, 0] },
      rightLeg: { rotation: [-sweep * 0.1, 0, 0] },
    };
  },
  (t) => {
    // Mopping animation:
    // Forward-and-back lunging push, mop dipping into bucket
    const push = Math.sin(t * 2.2);
    const dip = Math.sin(t * 0.8) > 0.7 ? Math.sin(t * 4) * 0.1 : 0;
    const lean = push * 0.12 + dip;
    return {
      prop: 'mop',
      body: {
        position: [0, -0.04 - dip * 0.05, push * 0.12],
        rotation: [0.18 + lean, Math.sin(t * 1.1) * 0.08, 0],
      },
      leftArm: { rotation: [0.55 + push * 0.35, 0.12, -0.1] },
      rightArm: { rotation: [0.55 + push * 0.35, -0.12, 0.1] },
      leftLeg: { rotation: [push * 0.12, 0, 0] },
      rightLeg: { rotation: [-push * 0.12, 0, 0] },
    };
  },
  (t) => {
    // Window squeegee/sponge cleaning animation:
    // Right arm makes smooth circular & vertical passes, body reaches up.
    const circleX = Math.cos(t * 3.5);
    const circleY = Math.sin(t * 3.5);
    const reach = Math.sin(t * 1.2) * 0.05;
    return {
      prop: 'sponge',
      body: {
        position: [0, 0.04 + reach, 0],
        rotation: [-0.08, circleX * 0.08, 0],
      },
      leftArm: { rotation: [-0.2, 0.1, 0.3] }, // Left hand on hip
      rightArm: { rotation: [-2.2 + circleY * 0.35, 0.1, circleX * 0.35] }, // Hand up, circular wipe
      leftLeg: { rotation: [0.02, 0, 0] },
      rightLeg: { rotation: [-0.02, 0, 0] },
    };
  },
];
