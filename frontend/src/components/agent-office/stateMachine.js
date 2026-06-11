/**
 * stateMachine.js
 * 
 * Manages agent lifecycle states and transitions for the office scene.
 * Each agent flows through: spawn → walk → work → emit → idle/next.
 * Agents are assigned positions within stations to avoid overlap.
 * 
 * CIRCULAR LAYOUT: Rooms arranged in an elliptical ring around the perimeter.
 * The Trading Floor dominates the center — 80s open-pit style.
 * ViewBox: 200×120, center: (100, 60)
 */

// ── Station definitions — circular layout ──
// Perimeter rooms arranged clockwise from top, Trading Floor in center
export const STATIONS = {
  // ── TOP: Research Desk ──
  research: {
    id: 'research',
    label: 'Research Desk',
    x: 72, y: 2,
    width: 56, height: 16,
    color: '#f59e0b',
    icon: '📰',
    slots: 6,
  },
  // ── UPPER-RIGHT: Trading Tools ──
  tool_bench: {
    id: 'tool_bench',
    label: 'Trading Tools',
    x: 150, y: 10,
    width: 30, height: 18,
    color: '#8b5cf6',
    icon: '⚙️',
    slots: 5,
  },
  // ── RIGHT: War Room ──
  debate: {
    id: 'debate',
    label: 'War Room',
    x: 164, y: 38,
    width: 26, height: 24,
    color: '#ec4899',
    icon: '🎯',
    slots: 4,
  },
  // ── LOWER-RIGHT: Exec Office ──
  inbox: {
    id: 'inbox',
    label: 'Exec Office',
    x: 146, y: 80,
    width: 34, height: 18,
    color: '#10b981',
    icon: '💼',
    slots: 3,
  },
  // ── BOTTOM: Risk Mgmt ──
  error: {
    id: 'error',
    label: 'Risk Mgmt',
    x: 72, y: 102,
    width: 56, height: 14,
    color: '#ef4444',
    icon: '⚠️',
    slots: 3,
  },
  // ── LOWER-LEFT: Break Room ──
  smoke_break: {
    id: 'smoke_break',
    label: 'Break Room',
    x: 18, y: 80,
    width: 34, height: 18,
    color: '#78716c',
    icon: '☕',
    slots: 6,
  },
  // ── LEFT: Reception / Lobby ──
  lobby: {
    id: 'lobby',
    label: 'Reception',
    x: 8, y: 38,
    width: 26, height: 24,
    color: '#64748b',
    icon: '🏢',
    slots: 4,
  },
  // ── CENTER: Trading Floor (the pit) ──
  desk: {
    id: 'desk',
    label: 'Trading Floor',
    x: 46, y: 24,
    width: 108, height: 64,
    color: '#6366f1',
    icon: '📈',
    slots: 8,
  },
  // ── EXIT (off-screen left) ──
  front_door: {
    id: 'front_door',
    label: 'Exit',
    x: -10, y: 48,
    width: 12, height: 16,
    color: '#475569',
    icon: '🚪',
    slots: 8,
  },
};

// ── 2D Obstacle map — bounding boxes for furniture agents must avoid ──
// Each obstacle has a padded bounding box (2 SVG units padding).
// Positions match the furniture rendered in AmbientElements.
export const OBSTACLES_2D = [
  // Trading desk 1 (center upper table)
  { x: 78, y: 45, w: 44, h: 9, label: 'trading_desk_1' },
  // Trading desk 2 (center lower table)
  { x: 73, y: 57, w: 54, h: 9, label: 'trading_desk_2' },
];

/**
 * Check if a line segment from (x1,y1) to (x2,y2) intersects a rectangle.
 * Uses parametric line clipping (Cohen-Sutherland style).
 */
function lineIntersectsRect(x1, y1, x2, y2, rect) {
  const { x, y, w, h } = rect;
  const left = x, right = x + w, top = y, bottom = y + h;

  let tMin = 0, tMax = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;

  // Check each edge
  const edges = [
    { p: -dx, q: x1 - left },
    { p: dx, q: right - x1 },
    { p: -dy, q: y1 - top },
    { p: dy, q: bottom - y1 },
  ];

  for (const { p, q } of edges) {
    if (Math.abs(p) < 1e-8) {
      // Parallel to edge — if outside, no intersection
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) {
        tMin = Math.max(tMin, t);
      } else {
        tMax = Math.min(tMax, t);
      }
      if (tMin > tMax) return false;
    }
  }
  return true;
}

/**
 * Find a path from start to end that avoids obstacles.
 * Returns an array of {x, y} waypoints (including the final destination).
 * The start point is NOT included in the returned array.
 *
 * Strategy: for each obstacle the straight line crosses, insert a
 * single detour waypoint that routes around the nearest edge.
 */
export function findPath(startX, startY, endX, endY, obstacles = OBSTACLES_2D) {
  // Collect all obstacles the direct path crosses
  const blocked = obstacles.filter(ob =>
    lineIntersectsRect(startX, startY, endX, endY, ob)
  );

  if (blocked.length === 0) {
    // Direct path is clear
    return [{ x: endX, y: endY }];
  }

  // For each blocking obstacle, compute a detour waypoint around the
  // nearest horizontal edge (top or bottom) since most cross-room paths
  // are diagonal and the tables are wide horizontals.
  const waypoints = [];
  let curX = startX, curY = startY;

  // Sort blocked obstacles by distance from start so we route in order
  blocked.sort((a, b) => {
    const distA = Math.hypot((a.x + a.w / 2) - startX, (a.y + a.h / 2) - startY);
    const distB = Math.hypot((b.x + b.w / 2) - startX, (b.y + b.h / 2) - startY);
    return distA - distB;
  });

  for (const ob of blocked) {
    const obCenterY = ob.y + ob.h / 2;
    const obCenterX = ob.x + ob.w / 2;
    const padding = 3; // extra clearance around obstacle edge

    // Pick whether to go above or below the obstacle — choose whichever
    // is closer to a straight line from current position to destination
    const goAbove = curY <= obCenterY;
    const detourY = goAbove ? ob.y - padding : ob.y + ob.h + padding;

    // X position: clamp to the obstacle's horizontal span so the detour
    // stays close to the natural diagonal path
    const naturalX = curX + (endX - curX) * 0.5;
    const detourX = Math.max(ob.x - padding, Math.min(ob.x + ob.w + padding, naturalX));

    waypoints.push({ x: detourX, y: detourY });
    curX = detourX;
    curY = detourY;
  }

  waypoints.push({ x: endX, y: endY });
  return waypoints;
}

// ── Agent states ──
export const AGENT_STATES = {
  SPAWNING: 'spawning',
  IDLE: 'idle',
  WALKING: 'walking',
  WORKING: 'working',
  EMITTING: 'emitting',   // producing result (paper, envelope, etc.)
  ERROR: 'error',
  EXITING: 'exiting',
  SMOKING: 'smoking',     // idle in break room
  DANCING: 'dancing',     // celebrating on trading floor
};

// ── Station slot management ──
const stationOccupancy = {};

function getSlotPosition(stationId, slotIndex) {
  const station = STATIONS[stationId];
  if (!station) return { x: 100, y: 60 };

  // Trading Floor (center): seat agents at the edges of the two trading desks
  // so they appear to be sitting AT the tables, not standing on them.
  // Desk 1 runs x:80–120, y:48 — agents sit above (y ≈ 44) and below (y ≈ 52)
  // Desk 2 runs x:75–125, y:60 — agents sit above (y ≈ 56) and below (y ≈ 64)
  if (stationId === 'desk') {
    const deskSlots = [
      // Front row (above desk 1)
      { x: 86, y: 44 },
      { x: 96, y: 44 },
      { x: 106, y: 44 },
      { x: 116, y: 44 },
      // Back row (below desk 2)
      { x: 82, y: 68 },
      { x: 94, y: 68 },
      { x: 106, y: 68 },
      { x: 118, y: 68 },
    ];
    return deskSlots[slotIndex % deskSlots.length];
  }
  
  // Debate (War Room): face-to-face across the table
  if (stationId === 'debate') {
    const centerY = station.y + station.height / 2;
    const positions = [
      { x: station.x + 5, y: centerY - 3 },
      { x: station.x + station.width - 5, y: centerY - 3 },
      { x: station.x + 8, y: centerY + 5 },
      { x: station.x + station.width - 8, y: centerY + 5 },
    ];
    return positions[slotIndex % positions.length];
  }

  // Lobby: spread within room
  if (stationId === 'lobby') {
    const cols = 2;
    const row = Math.floor(slotIndex / cols);
    const col = slotIndex % cols;
    return {
      x: station.x + 5 + col * 10,
      y: station.y + 6 + row * 8,
    };
  }
  
  // General perimeter rooms: grid-style layout
  const totalSlots = station.slots || 1;
  const cols = Math.min(totalSlots, 3);
  const row = Math.floor(slotIndex / cols);
  const col = slotIndex % cols;
  const slotWidth = station.width / (cols + 1);
  const slotHeight = station.height / 2.5;
  
  return {
    x: station.x + slotWidth * (col + 0.5) + (slotIndex % 2 === 0 ? 1 : -1),
    y: station.y + 6 + row * slotHeight + (col % 2 === 0 ? -1 : 1),
  };
}

function claimSlot(stationId) {
  if (!stationOccupancy[stationId]) {
    stationOccupancy[stationId] = new Set();
  }
  const station = STATIONS[stationId];
  const maxSlots = station?.slots || 3;
  
  for (let i = 0; i < maxSlots; i++) {
    if (!stationOccupancy[stationId].has(i)) {
      stationOccupancy[stationId].add(i);
      return i;
    }
  }
  // All full — stack on last slot
  return maxSlots - 1;
}

function releaseSlot(stationId, slotIndex) {
  if (stationOccupancy[stationId]) {
    stationOccupancy[stationId].delete(slotIndex);
  }
}

// ── Agent color palette (deterministic by ID hash) ──
const AGENT_COLORS = [
  '#818cf8', '#f472b6', '#34d399', '#fbbf24',
  '#a78bfa', '#fb923c', '#22d3ee', '#f87171',
  '#4ade80', '#c084fc', '#38bdf8', '#e879f9',
];

function getAgentColor(agentId) {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) - hash + agentId.charCodeAt(i)) | 0;
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

// ── Agent body poses ──
export const POSES = {
  idle: 'idle',
  walk: 'walk',
  sit: 'sit',
  argue: 'argue',
  deliver: 'deliver',
  confused: 'confused',
  dance: 'dance',
  smoke: 'smoke',
  celebrate: 'celebrate',
};

function getPoseForStation(stationId, agentState) {
  if (agentState === AGENT_STATES.WALKING) return POSES.walk;
  if (agentState === AGENT_STATES.ERROR) return POSES.confused;
  if (agentState === AGENT_STATES.EMITTING) return POSES.deliver;
  if (agentState === AGENT_STATES.DANCING) return POSES.dance;
  if (agentState === AGENT_STATES.SMOKING) return POSES.smoke;
  
  switch (stationId) {
    case 'desk': return POSES.sit;          // working at trading terminal
    case 'debate': return POSES.argue;
    case 'inbox': return POSES.deliver;
    case 'error': return POSES.confused;
    case 'smoke_break': return POSES.smoke; // relaxed smoking pose
    case 'research': return POSES.sit;      // typing at desk
    case 'tool_bench': return POSES.idle;   // using tools
    default: return POSES.idle;
  }
}

/**
 * Create an initial agent state object.
 */
export function createAgent(id) {
  const slot = claimSlot('lobby');
  const pos = getSlotPosition('lobby', slot);
  
  return {
    id,
    state: AGENT_STATES.SPAWNING,
    station: 'lobby',
    targetStation: null,
    slot,
    x: pos.x,
    y: pos.y,
    targetX: pos.x,
    targetY: pos.y,
    color: getAgentColor(id),
    pose: POSES.idle,
    tool: null,
    toolEmoji: null,     // emoji from prism webhook (unicode string, URL, or null)
    bubble: null,
    bubbleType: 'info',   // 'info' | 'error' | 'thinking' | 'success'
    bubbleTimer: null,
    props: [],            // visual props: 'paper', 'envelope', 'folder'
    spawnTime: Date.now(),
    lastActionTime: Date.now(),
  };
}

/**
 * Transition an agent to a new station.
 * Returns a new agent object with updated target position.
 * Computes obstacle-avoiding waypoints so agents route around furniture.
 */
export function moveAgent(agent, targetStation, tool, label, status) {
  // Release old slot
  releaseSlot(agent.station, agent.slot);
  
  // Claim new slot
  const newSlot = claimSlot(targetStation);
  const targetPos = getSlotPosition(targetStation, newSlot);
  
  const newState = status === 'error' ? AGENT_STATES.ERROR : AGENT_STATES.WALKING;
  const pose = getPoseForStation(targetStation, newState);
  
  // Determine bubble content
  let bubble = null;
  let bubbleType = 'info';
  
  if (tool) {
    bubble = tool;
    if (status === 'error') {
      bubbleType = 'error';
    } else if (status === 'start' || status === 'progress') {
      bubbleType = 'thinking';
    } else if (status === 'done') {
      bubbleType = 'success';
    }
  }
  
  // Determine props to emit on completion
  let props = [...(agent.props || [])];
  if (status === 'done') {
    if (targetStation === 'desk') props.push('paper');
    if (targetStation === 'inbox') props.push('envelope');
    if (targetStation === 'research') props.push('folder');
    if (targetStation === 'debate') props.push('report');
    // Cap props
    if (props.length > 8) props = props.slice(-8);
  }

  // Compute obstacle-avoiding waypoints
  const waypoints = findPath(agent.x, agent.y, targetPos.x, targetPos.y);
  // First waypoint is the immediate CSS transition target
  const firstWp = waypoints[0];
  // Remaining waypoints will be stepped through by the walk timer
  const remainingWaypoints = waypoints.slice(1);
  
  return {
    ...agent,
    state: newState,
    targetStation,
    slot: newSlot,
    // Set x/y to first waypoint so CSS transition animates toward it
    x: firstWp.x,
    y: firstWp.y,
    targetX: targetPos.x,
    targetY: targetPos.y,
    waypoints: remainingWaypoints, // remaining waypoints after the first
    pose,
    tool: tool || agent.tool,
    toolEmoji: agent.toolEmoji,
    bubble,
    bubbleType,
    props,
    lastActionTime: Date.now(),
  };
}

/**
 * Mark an agent as arrived at their target station.
 */
export function arriveAgent(agent) {
  const workState = agent.state === AGENT_STATES.ERROR 
    ? AGENT_STATES.ERROR 
    : AGENT_STATES.WORKING;
  const pose = getPoseForStation(agent.targetStation || agent.station, workState);
  
  return {
    ...agent,
    state: workState,
    station: agent.targetStation || agent.station,
    targetStation: null,
    x: agent.targetX,
    y: agent.targetY,
    pose,
  };
}

/**
 * Clear an agent's bubble (after timeout).
 */
export function clearBubble(agent) {
  return {
    ...agent,
    bubble: null,
    bubbleType: 'info',
  };
}

/**
 * Process a mapped office event and update agent states.
 * Returns updated agents map.
 */
export function processEvent(agents, officeEvent) {
  const { agentId, station, tool, toolEmoji, label, status } = officeEvent;
  
  let agent = agents[agentId];
  
  // Create agent if new
  if (!agent) {
    agent = createAgent(agentId);
  }
  
  // Move agent to appropriate station
  if (station && station !== agent.station) {
    // If already walking to this same station, just update bubble (don't re-target/re-slot)
    if (agent.state === AGENT_STATES.WALKING && agent.targetStation === station) {
      let bubble = tool || agent.tool;
      let bubbleType = status === 'error' ? 'error'
        : status === 'done' ? 'success'
        : status === 'start' ? 'thinking'
        : 'info';
      agent = {
        ...agent,
        tool: tool || agent.tool,
        toolEmoji: toolEmoji !== undefined ? toolEmoji : agent.toolEmoji,
        bubble,
        bubbleType,
        lastActionTime: Date.now(),
      };
    } else {
      agent = moveAgent(agent, station, tool, label, status);
    }
  } else {
    // Same station — update bubble/tool
    let bubble = tool || agent.tool;
    let bubbleType = status === 'error' ? 'error' 
      : status === 'done' ? 'success'
      : status === 'start' ? 'thinking' 
      : 'info';
    
    agent = {
      ...agent,
      tool: tool || agent.tool,
      toolEmoji: toolEmoji !== undefined ? toolEmoji : agent.toolEmoji,
      bubble,
      bubbleType,
      lastActionTime: Date.now(),
    };
    if (station === agent.station) {
      agent = arriveAgent({ ...agent, targetStation: station });
    }
  }
  
  return { ...agents, [agentId]: agent };
}

/**
 * Reset all station occupancy tracking (call on cycle start).
 */
export function resetOccupancy() {
  for (const key of Object.keys(stationOccupancy)) {
    delete stationOccupancy[key];
  }
}

/**
 * Move an agent to the smoke break room to wait.
 * Used instead of deleting agents — keeps them visible and recyclable.
 */
export function sendToSmokeBreak(agent) {
  releaseSlot(agent.station, agent.slot);
  const newSlot = claimSlot('smoke_break');
  const targetPos = getSlotPosition('smoke_break', newSlot);
  
  // Compute obstacle-avoiding waypoints
  const waypoints = findPath(agent.x, agent.y, targetPos.x, targetPos.y);
  const firstWp = waypoints[0];
  const remainingWaypoints = waypoints.slice(1);
  
  return {
    ...agent,
    state: AGENT_STATES.WALKING,
    targetStation: 'smoke_break',
    slot: newSlot,
    x: firstWp.x,
    y: firstWp.y,
    targetX: targetPos.x,
    targetY: targetPos.y,
    waypoints: remainingWaypoints,
    pose: POSES.walk,
    tool: null,
    bubble: null,
    bubbleType: 'info',
    lastActionTime: Date.now(),
  };
}

/**
 * Find an idle agent in smoke_break that can be recycled for a new job.
 * Returns the agent ID or null if none available.
 */
export function findRecyclableAgent(agents) {
  for (const [id, agent] of Object.entries(agents)) {
    if (id === 'system') continue;
    if (
      agent.station === 'smoke_break' &&
      (agent.state === AGENT_STATES.SMOKING ||
       agent.state === AGENT_STATES.WORKING ||
       agent.state === AGENT_STATES.IDLE)
    ) {
      return id;
    }
  }
  return null;
}

/**
 * Move an agent to the front door for exit animation.
 */
export function sendToFrontDoor(agent) {
  releaseSlot(agent.station, agent.slot);
  const newSlot = claimSlot('front_door');
  const targetPos = getSlotPosition('front_door', newSlot);
  
  // Compute obstacle-avoiding waypoints
  const waypoints = findPath(agent.x, agent.y, targetPos.x, targetPos.y);
  const firstWp = waypoints[0];
  const remainingWaypoints = waypoints.slice(1);
  
  return {
    ...agent,
    state: AGENT_STATES.WALKING,
    targetStation: 'front_door',
    slot: newSlot,
    x: firstWp.x,
    y: firstWp.y,
    targetX: targetPos.x,
    targetY: targetPos.y,
    waypoints: remainingWaypoints,
    pose: POSES.walk,
    tool: null,
    bubble: null,
    lastActionTime: Date.now(),
  };
}

/**
 * Get summary stats for the scene.
 */
export function getSceneStats(agents) {
  const stats = {
    total: 0,
    byStation: {},
    byState: {},
    activeTools: [],
    completedEnvelopes: 0,
  };
  
  for (const agent of Object.values(agents)) {
    stats.total++;
    stats.byStation[agent.station] = (stats.byStation[agent.station] || 0) + 1;
    stats.byState[agent.state] = (stats.byState[agent.state] || 0) + 1;
    if (agent.tool && (agent.state === AGENT_STATES.WORKING || agent.state === AGENT_STATES.DANCING)) {
      stats.activeTools.push({ agentId: agent.id, tool: agent.tool });
    }
    stats.completedEnvelopes += (agent.props || []).filter(p => p === 'envelope').length;
  }
  
  return stats;
}
