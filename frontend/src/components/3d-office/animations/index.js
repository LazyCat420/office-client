/**
 * animations/index.js — Barrel export for the animation system.
 * /lego module: Single import point for all animation needs.
 *
 * Usage:
 *   import { getAnimation, walkingAnim, STATION_FACING, pickVariant } from './animations';
 */

export { getAnimation, getTalkingAnimation, getGestureAnimation } from './registry';
export { walkingAnim } from './walk';
export { STATION_FACING, STATION_ANIM_VARIANTS, pickVariant } from './types';

// Re-export individual station anim arrays for custom use
export { DESK_ANIMS } from './desk';
export { RESEARCH_ANIMS } from './research';
export { TOOLS_ANIMS } from './tools';
export { DEBATE_ANIMS } from './debate';
export { EXEC_ANIMS } from './exec';
export { RISK_ANIMS } from './risk';
export { LOBBY_ANIMS } from './lobby';
export { SMOKE_ANIMS } from './smoke';
export { JANITOR_ANIMS } from './janitor';
export { TALKING_ANIMS } from './talking';
export { GESTURE_ANIMS, GESTURE_PROPS, GESTURE_DURATIONS } from './gestures';
