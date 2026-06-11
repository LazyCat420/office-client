/**
 * stateMachine.js (3D Version)
 * 
 * CIRCULAR LAYOUT: 7 rooms arranged in a ring (radius ~16) around a
 * central Trading Pit. Entrance faces south (+Z, toward camera).
 * Coordinates: X (left/right), Z (forward/backward, +Z = toward camera).
 */

import { pickVariant, STATION_FACING } from '../animations';
import { getToolAnimVariant, getCompletionVariant } from './toolStationMap';
import { nudgeIfBlocked, findWaypoints } from './collisionMap';

// ── Room angles (clockwise from south/+Z, radians) ──
const A = {
  lobby:       0,
  inbox:       2 * Math.PI / 7,   // ~51.4°
  debate:      4 * Math.PI / 7,   // ~102.9°
  tool_bench:  6 * Math.PI / 7,   // ~154.3°
  research:    8 * Math.PI / 7,   // ~205.7°
  error:       10 * Math.PI / 7,  // ~257.1°
  smoke_break: 12 * Math.PI / 7,  // ~308.6°
};
const R_ROOM = 23.5; // radius for room centers

export const STATIONS = {
  lobby: {
    id: 'lobby', label: 'Reception',
    x: R_ROOM * Math.sin(A.lobby),
    z: R_ROOM * Math.cos(A.lobby),
    width: 10, depth: 8,
    color: '#64748b', icon: '🏢', slots: 20,
    angle: A.lobby,
  },
  inbox: {
    id: 'inbox', label: 'Exec Office',
    x: R_ROOM * Math.sin(A.inbox),
    z: R_ROOM * Math.cos(A.inbox),
    width: 10, depth: 8,
    color: '#10b981', icon: '💼', slots: 10,
    angle: A.inbox,
  },
  debate: {
    id: 'debate', label: 'War Room',
    x: R_ROOM * Math.sin(A.debate),
    z: R_ROOM * Math.cos(A.debate),
    width: 10, depth: 8,
    color: '#ec4899', icon: '🎯', slots: 10,
    angle: A.debate,
  },
  tool_bench: {
    id: 'tool_bench', label: 'Trading Tools',
    x: R_ROOM * Math.sin(A.tool_bench),
    z: R_ROOM * Math.cos(A.tool_bench),
    width: 10, depth: 8,
    color: '#8b5cf6', icon: '⚙️', slots: 12,
    angle: A.tool_bench,
  },
  research: {
    id: 'research', label: 'Research Desk',
    x: R_ROOM * Math.sin(A.research),
    z: R_ROOM * Math.cos(A.research),
    width: 10, depth: 8,
    color: '#f59e0b', icon: '📰', slots: 12,
    angle: A.research,
  },
  error: {
    id: 'error', label: 'Risk Mgmt',
    x: R_ROOM * Math.sin(A.error),
    z: R_ROOM * Math.cos(A.error),
    width: 10, depth: 8,
    color: '#ef4444', icon: '⚠️', slots: 8,
    angle: A.error,
  },
  smoke_break: {
    id: 'smoke_break', label: 'Break Room',
    x: R_ROOM * Math.sin(A.smoke_break),
    z: R_ROOM * Math.cos(A.smoke_break),
    width: 10, depth: 8,
    color: '#475569', icon: '🚬', slots: 20,
    angle: A.smoke_break,
  },
  desk: {
    id: 'desk', label: 'Trading Floor',
    x: 0, z: 0,
    width: 20, depth: 20,
    color: '#6366f1', icon: '📈', slots: 24,
    angle: 0,
  },
  janitor: {
    id: 'janitor', label: 'Cleaning Duty',
    x: 0, z: 0,
    width: 28, depth: 28,
    color: '#38bdf8', icon: '🧹', slots: 20,
    angle: 0,
  },
  exit_door: {
    id: 'exit_door', label: 'Exit',
    x: 0, z: 26,
    width: 4, depth: 2,
    color: '#64748b', icon: '🚪', slots: 20,
    angle: 0,
  },
};

export const AGENT_STATES = {
  SPAWNING: 'spawning',
  IDLE: 'idle',
  WALKING: 'walking',
  WORKING: 'working',
  EMITTING: 'emitting',
  ERROR: 'error',
  EXITING: 'exiting',
};

const stationOccupancy = {};

// ── Helper: rotate a local room position (lx, lz) by room angle ──
function rotatePoint(lx, lz, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: lx * cos + lz * sin,
    z: -lx * sin + lz * cos,
  };
}

// ── Helper: generate custom spots for a perimeter room at a given angle ──
function makeRoomSpots(roomType, angle) {
  let localSpots = [];
  
  if (roomType === 'lobby') {
    localSpots = [
      { lx: 0, lz: 20.0, facing: Math.PI },       // behind desk
      { lx: -0.5, lz: 17.6, facing: 0 },          // visitor
      { lx: 0.5, lz: 17.6, facing: 0 },           // visitor
      { lx: -3.0, lz: 15.5, facing: 0 },          // on couch
      { lx: -2.5, lz: 15.5, facing: 0 },          // on couch
      { lx: -3.5, lz: 15.5, facing: 0 },          // on couch
      { lx: 2.0, lz: 16.0, facing: Math.PI / 4 }, // standing
      { lx: 1.5, lz: 14.5, facing: -Math.PI / 4 },// standing
      { lx: -1.5, lz: 14.0, facing: 0 },          // standing
      { lx: 2.5, lz: 18.0, facing: Math.PI },     // standing
    ];
  } else if (roomType === 'inbox') {
    localSpots = [
      { lx: 0, lz: 16.2, facing: 0 },             // in chair facing table
      { lx: -1.0, lz: 18.8, facing: Math.PI },    // behind desk
      { lx: 1.0, lz: 18.8, facing: Math.PI },     // behind desk
      { lx: -2.5, lz: 17.5, facing: Math.PI / 2 },// side
      { lx: 2.5, lz: 17.5, facing: -Math.PI / 2 },// side
      { lx: -1.0, lz: 14.0, facing: 0 },          // couch
      { lx: 1.0, lz: 14.0, facing: 0 },           // couch
      { lx: 0, lz: 14.0, facing: 0 },             // couch
      { lx: -2.0, lz: 15.0, facing: Math.PI / 3 },// standing
      { lx: 2.0, lz: 15.0, facing: -Math.PI / 3 },// standing
    ];
  } else if (roomType === 'debate') {
    localSpots = [
      { lx: -1.5, lz: 14.7, facing: 0 },          // chair facing table
      { lx: 1.5, lz: 14.7, facing: 0 },           // chair facing table
      { lx: 0, lz: 18.3, facing: Math.PI },       // chair facing table
      { lx: -2.5, lz: 16.5, facing: Math.PI / 2 },// chair facing table
      { lx: 2.5, lz: 16.5, facing: -Math.PI / 2 },// standing
      { lx: -1.0, lz: 18.2, facing: Math.PI },    // standing
      { lx: 1.0, lz: 18.2, facing: Math.PI },     // standing
      { lx: -2.5, lz: 18.0, facing: Math.PI / 2 },// whiteboard area
      { lx: 2.5, lz: 18.0, facing: -Math.PI / 2 },// whiteboard area
      { lx: 0, lz: 14.5, facing: 0 },             // standing
    ];
  } else if (roomType === 'tool_bench') {
    localSpots = [
      { lx: -1.97, lz: 17.0, facing: Math.PI / 2 }, // chair facing table
      { lx: 1.97, lz: 17.0, facing: -Math.PI / 2 },// chair facing table
      { lx: -1.97, lz: 18.5, facing: Math.PI / 2 }, // table side near monitor
      { lx: 1.97, lz: 18.5, facing: -Math.PI / 2 },// table side near monitor
      { lx: -1.97, lz: 15.5, facing: Math.PI / 2 }, // table side near monitor
      { lx: 1.97, lz: 15.5, facing: -Math.PI / 2 },// table side near monitor
      { lx: 0, lz: 19.5, facing: Math.PI },        // table end
      { lx: 0, lz: 14.5, facing: 0 },              // table end
      { lx: -2.0, lz: 20.0, facing: Math.PI / 2 }, // server rack area
      { lx: 2.0, lz: 20.0, facing: -Math.PI / 2 },// server rack area
    ];
  } else if (roomType === 'research') {
    localSpots = [
      { lx: -1.97, lz: 18.5, facing: Math.PI / 2 },
      { lx:  1.97, lz: 18.5, facing: -Math.PI / 2 },
      { lx: -1.97, lz: 15.5, facing: Math.PI / 2 },
      { lx:  1.97, lz: 15.5, facing: -Math.PI / 2 },
      { lx: -1.97, lz: 17.0, facing: Math.PI / 2 },
      { lx:  1.97, lz: 17.0, facing: -Math.PI / 2 },
      { lx: -1.97, lz: 19.5, facing: Math.PI / 2 },
      { lx:  1.97, lz: 19.5, facing: -Math.PI / 2 },
      { lx: -1.97, lz: 14.5, facing: Math.PI / 2 },
      { lx:  1.97, lz: 14.5, facing: -Math.PI / 2 },
      { lx:  0,   lz: 20.0, facing: Math.PI },
      { lx:  0,   lz: 14.0, facing: 0 },
    ];
  } else if (roomType === 'error') {
    localSpots = [
      { lx: 0, lz: 15.6, facing: 0 },             // chair facing table
      { lx: -1.5, lz: 18.3, facing: Math.PI },    // behind table
      { lx: 1.5, lz: 18.3, facing: Math.PI },     // behind table
      { lx: 0, lz: 18.3, facing: Math.PI },       // behind table
      { lx: -2.5, lz: 17.0, facing: Math.PI / 2 },// side
      { lx: 2.5, lz: 17.0, facing: -Math.PI / 2 },// side
      { lx: -1.5, lz: 15.6, facing: 0 },          // standing
      { lx: 1.5, lz: 15.6, facing: 0 },           // standing
      { lx: -2.0, lz: 19.5, facing: Math.PI / 2 },// server rack
      { lx: 2.0, lz: 19.5, facing: -Math.PI / 2 },// server rack
    ];
  } else if (roomType === 'smoke_break') {
    localSpots = [
      { lx: -1.5, lz: 17.5, facing: 0 },          // counter table
      { lx: -0.5, lz: 17.5, facing: 0 },          // counter table
      { lx: -2.5, lz: 17.5, facing: 0 },          // counter table
      { lx: 2.0, lz: 14.5, facing: 0 },           // chair
      { lx: 2.0, lz: 17.5, facing: Math.PI },     // chair
      { lx: 0.5, lz: 16.0, facing: Math.PI / 2 }, // small table side
      { lx: 3.5, lz: 16.0, facing: -Math.PI / 2 },// small table side
      { lx: -1.5, lz: 14.5, facing: 0 },          // couch
      { lx: -0.8, lz: 14.5, facing: 0 },          // couch
      { lx: -2.2, lz: 14.5, facing: 0 },          // couch
    ];
  }

  const ROOM_OFFSET = 7.5;
  return localSpots.map(s => {
    const p = rotatePoint(s.lx, s.lz + ROOM_OFFSET, angle);
    return {
      x: p.x,
      z: p.z,
      facing: s.facing + angle,
    };
  });
}

// ── Predefined spots matched to furniture ──
const STATION_SPOTS = {
  lobby: makeRoomSpots('lobby', A.lobby),
  inbox: makeRoomSpots('inbox', A.inbox),
  debate: makeRoomSpots('debate', A.debate),
  tool_bench: makeRoomSpots('tool_bench', A.tool_bench),
  research: makeRoomSpots('research', A.research),
  error: makeRoomSpots('error', A.error),
  smoke_break: makeRoomSpots('smoke_break', A.smoke_break),
  desk: [
    // Inner ring (radius 7.5)
    { x: 0, z: 7.5, facing: Math.PI },
    { x: 5.31, z: 5.31, facing: 3*Math.PI/4 + Math.PI },
    { x: 7.5, z: 0, facing: Math.PI/2 + Math.PI },
    { x: 5.31, z: -5.31, facing: Math.PI/4 + Math.PI },
    { x: 0, z: -7.5, facing: Math.PI * 2 },
    { x: -5.31, z: -5.31, facing: -Math.PI/4 + Math.PI },
    { x: -7.5, z: 0, facing: -Math.PI/2 + Math.PI },
    { x: -5.31, z: 5.31, facing: -3*Math.PI/4 + Math.PI },
    // Outer ring (radius 12)
    { x: 0, z: 12, facing: Math.PI },
    { x: 6, z: 10.39, facing: 5*Math.PI/6 + Math.PI },
    { x: 10.39, z: 6, facing: 2*Math.PI/3 + Math.PI },
    { x: 12, z: 0, facing: Math.PI/2 + Math.PI },
    { x: 10.39, z: -6, facing: Math.PI/3 + Math.PI },
    { x: 6, z: -10.39, facing: Math.PI/6 + Math.PI },
    { x: 0, z: -12, facing: Math.PI * 2 },
    { x: -6, z: -10.39, facing: -Math.PI/6 + Math.PI },
    { x: -10.39, z: -6, facing: -Math.PI/3 + Math.PI },
    { x: -12, z: 0, facing: -Math.PI/2 + Math.PI },
    { x: -10.39, z: 6, facing: -2*Math.PI/3 + Math.PI },
    { x: -6, z: 10.39, facing: -5*Math.PI/6 + Math.PI },
  ],
  janitor: [
    { x: 0, z: 12, facing: 0 },
    { x: 12, z: 12, facing: Math.PI / 4 },
    { x: 15, z: 0, facing: Math.PI / 2 },
    { x: 12, z: -12, facing: 3 * Math.PI / 4 },
    { x: -12, z: -12, facing: -3 * Math.PI / 4 },
    { x: -15, z: 0, facing: -Math.PI / 2 },
    { x: -12, z: 12, facing: -Math.PI / 4 },
    { x: 0, z: 3, facing: Math.PI },
    { x: 3, z: -3, facing: Math.PI / 3 },
    { x: -3, z: -3, facing: -Math.PI / 3 },
  ],
  exit_door: [
    { x: -1, z: 26, facing: 0 },
    { x: 0, z: 26, facing: 0 },
    { x: 1, z: 26, facing: 0 },
    { x: -1.5, z: 27, facing: 0 },
    { x: 0, z: 27, facing: 0 },
    { x: 1.5, z: 27, facing: 0 },
  ],
};

function getSlotPosition(stationId, slotIndex, agentId) {
  const spots = STATION_SPOTS[stationId];
  if (spots && slotIndex < spots.length) {
    return spots[slotIndex];
  }

  const station = STATIONS[stationId];
  if (!station) return { x: 0, z: 0, facing: 0 };
  
  // Small deterministic jitter using agentId hash (prevents exact overlaps)
  let jitterX = 0;
  let jitterZ = 0;
  if (agentId) {
    let hash = 0;
    for (let i = 0; i < agentId.length; i++) {
      hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
    }
    jitterX = (Math.abs(hash % 100) / 100 - 0.5) * 0.3;
    jitterZ = (Math.abs((hash >> 8) % 100) / 100 - 0.5) * 0.3;
  }

  // Fallback for overflow: place agents in an organic cluster (Fermat's spiral) instead of a ring
  const overflowIndex = slotIndex - (spots ? spots.length : 0);
  const goldenAngle = 137.508 * (Math.PI / 180);
  const radius = 3.5 + Math.sqrt(overflowIndex) * 1.5;
  const theta = overflowIndex * goldenAngle + (jitterX * 5); // Add jitter for minor organic noise

  return {
    x: station.x + radius * Math.cos(theta) + jitterX,
    z: station.z + radius * Math.sin(theta) + jitterZ,
    facing: Math.atan2(-Math.sin(station.angle || 0), -Math.cos(station.angle || 0)),
  };
}

// Wrapper that validates spot against collision map
function getSafeSlotPosition(stationId, slotIndex, agentId) {
  const pos = getSlotPosition(stationId, slotIndex, agentId);
  const spots = STATION_SPOTS[stationId];
  if (spots && slotIndex < spots.length) {
    // Skip nudging for predefined spots as they are already hand-placed
    return pos;
  }
  const safe = nudgeIfBlocked(pos.x, pos.z, 0.5);
  return { ...pos, x: safe.x, z: safe.z };
}

// Unlimited slot claiming — find the next available index for any station
function claimSlot(stationId) {
  if (!stationOccupancy[stationId]) stationOccupancy[stationId] = new Set();
  let i = 0;
  while (stationOccupancy[stationId].has(i)) i++;
  stationOccupancy[stationId].add(i);
  return i;
}

export function releaseSlot(stationId, slotIndex) {
  if (stationOccupancy[stationId]) {
    stationOccupancy[stationId].delete(slotIndex);
  }
}

const AGENT_COLORS = [
  '#f472b6', '#fb923c', '#facc15', '#a3e635', '#34d399',
  '#22d3ee', '#818cf8', '#c084fc', '#f87171', '#60a5fa',
  '#fb7185', '#fbbf24', '#4ade80', '#2dd4bf', '#a78bfa',
  '#e879f9', '#38bdf8', '#f97316', '#d946ef', '#06b6d4',
];

export function createAgent(agentId, ts) {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % AGENT_COLORS.length;

  const slot = claimSlot('lobby');
  const pos = getSafeSlotPosition('lobby', slot, agentId);
  const opponentId = agentId === 'BULLISH_DEBATER' ? 'BEARISH_DEBATER' : (agentId === 'BEARISH_DEBATER' ? 'BULLISH_DEBATER' : null);

  return {
    id: agentId,
    station: 'lobby',
    state: AGENT_STATES.SPAWNING,
    color: AGENT_COLORS[colorIndex],
    slot,
    x: pos.x,
    z: pos.z,
    targetX: pos.x,
    targetZ: pos.z,
    targetStation: 'lobby',
    animVariant: pickVariant(agentId, 'lobby'),
    facing: pos.facing,
    opponentId,
    tool: null,
    toolEmoji: null,
    bubble: null,
    bubbleType: null,
    lastActionTime: ts || Date.now(),
  };
}

// Walk helper — any state going to a named station
export function moveAgent(agent, targetStation, tool, label, status, toolEmoji, ts) {
  releaseSlot(agent.station, agent.slot);
  const newSlot = claimSlot(targetStation);
  const targetPos = getSafeSlotPosition(targetStation, newSlot, agent.id);
  const newState = AGENT_STATES.WALKING;
  
  let bubbleType = 'info';
  if (tool) {
    if (status === 'error') bubbleType = 'error';
    else if (status === 'start' || status === 'progress') bubbleType = 'thinking';
    else if (status === 'done') bubbleType = 'success';
  }
  
  // Use tool-aware animation variant — deterministic per agent+tool combo
  const activeTool = tool || agent.tool;
  const animVariant = getToolAnimVariant(activeTool, agent.id, targetStation, toolEmoji);
  
  // Compute waypoints to avoid obstacles (especially the trading pit)
  const startX = agent.x || agent.targetX || 0;
  const startZ = agent.z || agent.targetZ || 0;
  const waypoints = findWaypoints(startX, startZ, targetPos.x, targetPos.z, 0.5);

  return {
    ...agent,
    state: newState, targetStation, slot: newSlot,
    targetX: targetPos.x, targetZ: targetPos.z,
    waypoints,  // array of [x, z] intermediate points
    waypointIndex: 0,
    animVariant,
    tool: activeTool, toolEmoji: toolEmoji !== undefined ? toolEmoji : agent.toolEmoji,
    bubble: activeTool, bubbleType,
    lastActionTime: ts || Date.now(),
    facing: targetPos.facing,
  };
}

// Agent arrives at destination — transition from WALKING to WORKING/IDLE/ERROR
export function arriveAgent(agent) {
  if (!agent) return agent;
  const arrivedStation = agent.targetStation || agent.station;
  const pos = getSafeSlotPosition(arrivedStation, agent.slot, agent.id);
  let nextState = AGENT_STATES.WORKING;
  if (arrivedStation === 'lobby' || arrivedStation === 'smoke_break') {
    nextState = AGENT_STATES.IDLE;
  } else if (arrivedStation === 'exit_door') {
    nextState = AGENT_STATES.EXITING;
  } else if (arrivedStation === 'error') {
    nextState = AGENT_STATES.ERROR;
  }
  
  const animVariant = getToolAnimVariant(agent.tool, agent.id, arrivedStation, agent.toolEmoji);
  
  return {
    ...agent,
    state: nextState,
    station: arrivedStation,
    animVariant,
    x: agent.targetX,
    z: agent.targetZ,
    facing: pos.facing,
  };
}

export function processEvent(agents, officeEvent) {
  const { agentId, station, tool, toolEmoji, label, status, ts } = officeEvent;
  let agent = agents[agentId] || createAgent(agentId, ts);
  
  const currentTargetStation = agent.state === AGENT_STATES.WALKING ? agent.targetStation : agent.station;
  
  if (station && station !== currentTargetStation) {
    agent = moveAgent(agent, station, tool, label, status, toolEmoji, ts);
  } else {
    // Agent is either already there, or walking to this station.
    if (agent.state === AGENT_STATES.WALKING) {
      agent = { 
        ...agent, 
        tool: tool || agent.tool, 
        toolEmoji: toolEmoji !== undefined ? toolEmoji : agent.toolEmoji, 
        bubble: tool || agent.tool, 
        lastActionTime: ts || Date.now() 
      };
    } else {
      let nextState = AGENT_STATES.WORKING;
      if (agent.station === 'lobby' || agent.station === 'smoke_break') {
        nextState = AGENT_STATES.IDLE;
      } else if (agent.station === 'error') {
        nextState = AGENT_STATES.ERROR;
      }
      let animVariant = getToolAnimVariant(tool || agent.tool, agent.id, agent.station, toolEmoji !== undefined ? toolEmoji : agent.toolEmoji);
      if (status === 'done') {
        animVariant = getCompletionVariant(agent.station);
      } else if (status === 'error') {
        animVariant = 0;
      }
      agent = { 
        ...agent, 
        state: nextState, 
        tool: tool || agent.tool, 
        toolEmoji: toolEmoji !== undefined ? toolEmoji : agent.toolEmoji, 
        bubble: tool || agent.tool, 
        animVariant,
        lastActionTime: ts || Date.now() 
      };
    }
    if (station === agent.station) {
      agent = arriveAgent({ ...agent, targetStation: station });
    }
  }
  return { ...agents, [agentId]: agent };
}

export function clearBubble(agent) {
  return {
    ...agent,
    bubble: null,
    bubbleType: 'info',
  };
}

export function resetOccupancy() {
  for (const key of Object.keys(stationOccupancy)) delete stationOccupancy[key];
}
