/**
 * roomConstraints.js
 *
 * Defines minimum agent requirements per critical room to prevent the user
 * from emptying rooms that the trading pipeline depends on.
 */

// Rooms where at least 1 agent must always remain
const CRITICAL_ROOMS = {
  research:  { min: 1, label: 'Research Desk' },
  error:     { min: 1, label: 'Risk Management' },
  inbox:     { min: 1, label: 'Exec Office' },
};

/**
 * Count how many agents are currently assigned to each room.
 * Counts both `station` (arrived) and `targetStation` (walking) as occupancy.
 */
function countAgentsPerRoom(agents) {
  const counts = {};
  for (const agent of Object.values(agents)) {
    const room = agent.targetStation || agent.station;
    if (room) {
      counts[room] = (counts[room] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Check if an agent can be moved from their current room to a target room.
 *
 * @param {string} agentId - The agent being moved
 * @param {string} fromRoom - Room the agent is currently in
 * @param {string} toRoom - Room the agent would be dropped into
 * @param {object} agents - Full agents map { agentId: agentState }
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function canMoveAgent(agentId, fromRoom, toRoom, agents) {
  // Moving to the same room is always fine (no-op)
  if (fromRoom === toRoom) {
    return { allowed: true };
  }

  // If the source room is critical, check if removing this agent
  // would drop the room below its minimum
  const constraint = CRITICAL_ROOMS[fromRoom];
  if (constraint) {
    const counts = countAgentsPerRoom(agents);
    const currentCount = counts[fromRoom] || 0;

    if (currentCount <= constraint.min) {
      return {
        allowed: false,
        reason: `${constraint.label} needs at least ${constraint.min} agent(s). Move another agent here first.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Get all critical rooms and their constraints (for UI display).
 */
export function getCriticalRooms() {
  return { ...CRITICAL_ROOMS };
}
