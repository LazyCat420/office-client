/**
 * registry.js — Master animation lookup.
 * /lego module: Imports from all station animation files and
 * provides a single getAnimation(station, variant, time) function.
 */

import { DESK_ANIMS } from './desk';
import { RESEARCH_ANIMS } from './research';
import { TOOLS_ANIMS } from './tools';
import { DEBATE_ANIMS } from './debate';
import { EXEC_ANIMS } from './exec';
import { RISK_ANIMS } from './risk';
import { LOBBY_ANIMS } from './lobby';
import { SMOKE_ANIMS } from './smoke';
import { JANITOR_ANIMS } from './janitor';
import { TALKING_ANIMS } from './talking';
import { GESTURE_ANIMS } from './gestures';

const STATION_ANIMS = {
  janitor: JANITOR_ANIMS,
  desk: DESK_ANIMS,
  research: RESEARCH_ANIMS,
  tool_bench: TOOLS_ANIMS,
  debate: DEBATE_ANIMS,
  inbox: EXEC_ANIMS,
  error: RISK_ANIMS,
  lobby: LOBBY_ANIMS,
  smoke_break: SMOKE_ANIMS,
};

/**
 * Get the animation state for a given station, variant, and time.
 * Returns { body, leftArm, rightArm, leftLeg, rightLeg, prop }
 */
export function getAnimation(station, variant, time) {
  const anims = STATION_ANIMS[station] || LOBBY_ANIMS;
  const fn = anims[variant % anims.length] || anims[0];
  return fn(time);
}

/**
 * Speech gesture while an agent's voice line is playing.
 * seed picks a stable per-agent variant so different agents talk differently.
 */
export function getTalkingAnimation(seed, time) {
  const fn = TALKING_ANIMS[Math.abs(seed || 0) % TALKING_ANIMS.length];
  return fn(time);
}

/**
 * One-shot reaction gesture (wave/cheer/facepalm), synced with SFX barks.
 * Unknown types fall back to the lobby idle pose.
 */
export function getGestureAnimation(type, time) {
  const fn = GESTURE_ANIMS[type];
  return fn ? fn(time) : getAnimation('lobby', 0, time);
}
