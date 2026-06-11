/**
 * routing/index.js — Barrel export for the station routing package.
 * /lego module: Tool→station classification, state machine, event processing.
 */

export {
  STATIONS,
  AGENT_STATES,
  createAgent,
  moveAgent,
  arriveAgent,
  processEvent,
  releaseSlot,
  resetOccupancy,
} from './stateMachine';

export {
  TOOL_TO_STATION,
  TOOL_TO_ANIM_VARIANT,
  classifyToolStation,
  getToolAnimVariant,
} from './toolStationMap';

export { useAgentEvents, cleanAgentId } from './useAgentEvents';

export {
  OBSTACLES,
  isPointBlocked,
  isLineBlocked,
  findWaypoints,
  nudgeIfBlocked,
  getCollision,
} from './collisionMap';
