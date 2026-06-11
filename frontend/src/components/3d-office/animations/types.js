/**
 * types.js — Animation constants and helpers.
 *
 * /lego module: Shared constants for the animation system.
 * No React, no JSX — pure data + math.
 */

// ── Number of animation variants per station ──
export const STATION_ANIM_VARIANTS = {
  desk: 5,         // yelling bid, throwing tickets, hand signals, jumping, DANCING
  research: 8,     // shuffling papers, comparing charts, flipping book, scanning doc, writing whiteboard, typing keyboard, talking
  tool_bench: 3,   // hammering, terminal, levers
  debate: 3,       // gesturing, table slam, pacing
  inbox: 3,        // boss lean, signing, phone call
  error: 3,        // panic, stressed, methodical
  lobby: 1,        // idle breathing
  smoke_break: 5,  // relax, pacing, inspect, leaning, chatting
  janitor: 3,      // sweeping, mopping, cleaning windows
};

// ── Default facing angles per station (Y rotation when arrived) ──
export const STATION_FACING = {
  desk: 0,              // Center — face forward
  lobby: Math.PI,       // South → face north (toward center)
  inbox: Math.PI + 2 * Math.PI / 7,
  debate: Math.PI + 4 * Math.PI / 7,
  tool_bench: Math.PI + 6 * Math.PI / 7,
  research: Math.PI + 8 * Math.PI / 7,
  error: Math.PI + 10 * Math.PI / 7,
  smoke_break: Math.PI + 12 * Math.PI / 7,
  janitor: 0,
  exit_door: 0,
};

// ── Helper: deterministic variant from agent ID + station ──
export function pickVariant(agentId, station) {
  let hash = 0;
  const key = agentId + station;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const count = STATION_ANIM_VARIANTS[station] || 1;
  return Math.abs(hash) % count;
}
