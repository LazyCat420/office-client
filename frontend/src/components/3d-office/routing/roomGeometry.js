/**
 * roomGeometry.js — The office floorplan's shared constants.
 *
 * Room angles used to be copy-pasted into stateMachine.js, collisionMap.js,
 * Stations.jsx and ToucanScene.jsx. When they drifted, agents walked to
 * coordinates the furniture wasn't at. Import from here instead.
 */

// ── Room angles (clockwise from south/+Z, radians) ──
export const ROOM_ANGLES = {
  lobby: 0,
  inbox: (2 * Math.PI) / 7, // ~51.4°
  debate: (4 * Math.PI) / 7, // ~102.9°
  tool_bench: (6 * Math.PI) / 7, // ~154.3°
  research: (8 * Math.PI) / 7, // ~205.7°
  error: (10 * Math.PI) / 7, // ~257.1°
  smoke_break: (12 * Math.PI) / 7, // ~308.6°
};

/** Radius from the office centre to each room's centre. */
export const R_ROOM = 23.5;
